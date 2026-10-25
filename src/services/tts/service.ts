import {
  BaseServiceParams,
  TextToSpeechRequest,
  TextToSpeechRequestOptions,
  TextToSpeechResponse,
  TextToSpeechResponseInfo,
  TextToSpeechSessionParams,
  TextToSpeechTokenParams,
} from "../..";
import { BaseService } from "../base";
import { RETRYABLE_STATUSES, TextToSpeechError } from "../../utils/errors/tts";
import { TextToSpeechSession } from "./session";

/**
 * The abort signal of one request. It aborts when `external` does, or after
 * `timeoutMs` with a `TimeoutError` unless `headersArrived()` runs first, so
 * a streamed body read at playback pace is not timed. `release()` stops the
 * timer and detaches from `external`; call it once the request is over, so
 * a signal shared by many requests does not collect listeners.
 */
function requestDeadline(timeoutMs: number, external?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException(`no audio within ${timeoutMs} ms`, "TimeoutError"),
      ),
    timeoutMs,
  );
  const forward = () => controller.abort(external?.reason);
  if (external?.aborted) forward();
  else external?.addEventListener("abort", forward, { once: true });
  return {
    signal: controller.signal,
    headersArrived: () => clearTimeout(timer),
    release: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", forward);
    },
  };
}

/** The longest delay `setTimeout` keeps; a longer one fires at once. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * `reader.read()`, given up after `timeoutMs` without a chunk: the reader is
 * then cancelled, which releases the connection, and the read rejects with
 * `stalled()`. The timer runs only while this read waits. A `timeoutMs` of
 * `0` (or `Infinity`) waits as long as the body does.
 */
async function readWithin<T>(
  reader: ReadableStreamDefaultReader<T>,
  timeoutMs: number,
  stalled: () => Error,
): Promise<ReadableStreamReadResult<T>> {
  if (!(timeoutMs > 0 && Number.isFinite(timeoutMs))) return reader.read();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<"expired">((resolve) => {
    timer = setTimeout(
      () => resolve("expired"),
      Math.min(timeoutMs, MAX_TIMER_MS),
    );
  });
  try {
    const result = await Promise.race([reader.read(), expired]);
    if (result !== "expired") return result;
  } finally {
    clearTimeout(timer);
  }
  await reader.cancel().catch(() => undefined);
  throw stalled();
}

const ENDPOINT_SPEECH = "/v1/speech";
const DEFAULT_TOKEN_BASE_URL = "https://token.assemblyai.com";
/** A zone's TTS host (`tts.eu.assemblyai.com`); its zone is the first group. */
const ZONE_TTS_HOST = /^(?:streaming-)?tts\.(us|eu)\.assemblyai\.com$/;

/**
 * The token host of the zone `ttsBaseUrl` is in, so a token is minted in the
 * zone its sessions use: `https://token.eu.assemblyai.com` for
 * `https://tts.eu.assemblyai.com`, `https://token.us.assemblyai.com` for
 * `https://tts.us.assemblyai.com`, and `https://token.assemblyai.com` for any
 * other host.
 */
function zoneTokenBaseUrl(ttsBaseUrl?: string): string {
  let host = "";
  try {
    if (ttsBaseUrl) host = new URL(ttsBaseUrl).hostname;
  } catch {
    // not a URL, so no zone
  }
  const zone = ZONE_TTS_HOST.exec(host)?.[1];
  return zone ? `https://token.${zone}.assemblyai.com` : DEFAULT_TOKEN_BASE_URL;
}

/** A streamed request's wait for the headers and first audio. */
const DEFAULT_STREAM_TIMEOUT_MS = 30_000;
/** How long one read of a streamed body may wait for audio. */
const DEFAULT_READ_TIMEOUT_MS = 30_000;
/** A buffered request waits for the whole audio; the API caps a request at 600 s. */
const DEFAULT_SYNTHESIZE_TIMEOUT_MS = 610_000;

/**
 * The reason in a FastAPI `detail`, which the token host answers refusals
 * with: a string, or a list of `{ loc, msg }` for a bad query parameter. A
 * list entry reads `<field>: <msg>`, its field being the last element of
 * `loc` (`["query", "expires_in_seconds"]`), and the entries are joined with
 * `"; "`. `param` is the first entry's field, when its `loc` names one after
 * the location (`query`, `body`, ...).
 */
function fastApiDetail(detail: unknown): { text?: string; param?: string } {
  if (typeof detail === "string") return { text: detail || undefined };
  if (!Array.isArray(detail)) return {};
  let param: string | undefined;
  const parts = detail.flatMap((entry: unknown, index) => {
    if (!entry || typeof entry !== "object") return [];
    const { loc, msg } = entry as { loc?: unknown; msg?: unknown };
    const field =
      Array.isArray(loc) && loc.length > 0
        ? String(loc[loc.length - 1])
        : undefined;
    if (index === 0 && Array.isArray(loc) && loc.length > 1) param = field;
    const part = [field, typeof msg === "string" ? msg : undefined]
      .filter(Boolean)
      .join(": ");
    return part ? [part] : [];
  });
  return { text: parts.join("; ") || undefined, param };
}

/**
 * Builds the `TextToSpeechError` for a non-200 response. The message is the
 * body's `message`, else its `error`, else the reason in a FastAPI `detail`
 * (the token host's refusals), else a generic one with the status.
 */
export async function speechErrorFromResponse(
  response: Response,
): Promise<TextToSpeechError> {
  const status = response.status;
  const requestId = response.headers.get("x-request-id") ?? undefined;
  const retryAfterHeader = response.headers.get("retry-after");
  let retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;
  if (retryAfter !== undefined && !Number.isFinite(retryAfter))
    retryAfter = undefined;

  let body: Record<string, unknown> | undefined;
  if (response.headers.get("content-type")?.startsWith("application/json")) {
    try {
      const parsed: unknown = await response.json();
      if (parsed && typeof parsed === "object")
        body = parsed as Record<string, unknown>;
    } catch {
      body = undefined;
    }
  }
  if (body) {
    const detail = fastApiDetail(body.detail);
    const message =
      (typeof body.message === "string" && body.message) ||
      (typeof body.error === "string" && body.error) ||
      detail.text ||
      `text-to-speech request failed with status ${status}`;
    const hint = body.retry_after_seconds;
    if (typeof hint === "number") retryAfter = Math.ceil(hint);
    return new TextToSpeechError(message, {
      status,
      errorCode: typeof body.code === "string" ? body.code : undefined,
      param: typeof body.param === "string" ? body.param : detail.param,
      requestId:
        typeof body.request_id === "string" ? body.request_id : requestId,
      retryable:
        typeof body.retryable === "boolean"
          ? body.retryable
          : RETRYABLE_STATUSES.has(status),
      retryAfter,
      errors: Array.isArray(body.errors)
        ? (body.errors as { message: string; param: string | null }[])
        : undefined,
      body,
    });
  }
  const text = (await response.text().catch(() => "")).trim();
  return new TextToSpeechError(
    `text-to-speech request failed with status ${status}${text ? `: ${text.slice(0, 200)}` : ""}`,
    {
      status,
      requestId,
      retryable: RETRYABLE_STATUSES.has(status),
      retryAfter,
    },
  );
}

function intHeader(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);
  if (value === null || !/^\s*\d+\s*$/.test(value)) return undefined;
  return Number(value);
}

/** Reads the `X-TTS-*` headers of a `200`. */
export function textToSpeechResponseInfo(
  headers: Headers,
): TextToSpeechResponseInfo {
  const unknownParams = headers
    .get("x-tts-unknown-params")
    ?.split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return {
    requestId: headers.get("x-request-id") ?? undefined,
    region: headers.get("x-tts-region") ?? undefined,
    model: headers.get("x-tts-model") ?? undefined,
    voiceId: headers.get("x-tts-voice-id") ?? undefined,
    language: headers.get("x-tts-language") ?? undefined,
    encoding: headers.get("x-tts-encoding") ?? undefined,
    sampleRate: intHeader(headers, "x-tts-sample-rate"),
    container: headers.get("x-tts-container") ?? undefined,
    bitRate: intHeader(headers, "x-tts-bit-rate"),
    contentType: headers.get("content-type") ?? undefined,
    voiceExpiresAt: intHeader(headers, "x-tts-voice-expires-at"),
    billedCharacters: intHeader(headers, "x-tts-billed-characters"),
    audioDurationMs: intHeader(headers, "x-tts-audio-duration-ms"),
    unknownParams: unknownParams?.length ? unknownParams : undefined,
  };
}

let warnedUnknownParams = false;

/**
 * Warns once per process that the API ignored body fields it does not know,
 * which is how a camelCase `sampleRate` in a request held in a variable (or
 * sent from plain JavaScript) shows up. The names stay on `unknownParams`.
 */
function warnUnknownParams(info: TextToSpeechResponseInfo) {
  if (warnedUnknownParams || !info.unknownParams) return;
  warnedUnknownParams = true;
  console.warn(
    `TextToSpeechService: the API ignored unknown request fields: ${info.unknownParams.join(", ")}. ` +
      "Request fields are snake_case, such as sample_rate; see unknownParams on the response.",
  );
}

/**
 * The audio of one streamed request, read as the API generates it.
 *
 * Iterate it (`for await (const chunk of speech)`) or read `body`, a web
 * `ReadableStream`. Chunk sizes vary and are not aligned to samples. A
 * failure after the first audio cuts the body: the iteration then throws a
 * `TextToSpeechError` with `retryable: true`. So does a body that sends no
 * audio for the request's `readTimeout` while a read waits for it; a read
 * of `body` with your own reader then rejects with that error too.
 * Aborting the request's `signal` stops the download, and the iteration
 * throws the signal's reason (an `AbortError` unless you gave another)
 * instead.
 */
export class TextToSpeechStream implements AsyncIterable<Uint8Array> {
  /** The reader of the running iteration, which `cancel()` goes through. */
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private readonly signal?: AbortSignal;

  constructor(
    /** What the response headers say: model, voice, encoding, sample rate, request id. */
    public readonly info: TextToSpeechResponseInfo,
    /** The audio bytes as they arrive. */
    public readonly body: ReadableStream<Uint8Array>,
    /** `signal`: the request's abort signal, whose abort ends the iteration with its reason. */
    options: { signal?: AbortSignal } = {},
  ) {
    this.signal = options.signal;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    const reader = (this.reader = this.body.getReader());
    const signal = this.signal;
    let finished = false;
    try {
      for (;;) {
        // An abort is the caller's own stop, not a cut to retry.
        if (signal?.aborted) throw signal.reason;
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
          result = await reader.read();
        } catch (error) {
          if (signal?.aborted) throw signal.reason;
          finished = true;
          // A stalled read rejects with its own cut error, which names the wait.
          if (error instanceof TextToSpeechError) throw error;
          throw new TextToSpeechError(
            "The response was cut before the audio was complete. Retry the request.",
            { status: 200, requestId: this.info.requestId, retryable: true },
          );
        }
        if (result.done) {
          finished = true;
          return;
        }
        if (result.value.byteLength > 0) yield result.value;
      }
    } finally {
      // A loop left early (a barge-in) must not keep downloading the rest.
      if (!finished) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
      if (this.reader === reader) this.reader = undefined;
    }
  }

  /** Reads the rest of the audio and returns it. */
  async bytes(): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of this) chunks.push(chunk);
    let size = 0;
    for (const chunk of chunks) size += chunk.byteLength;
    const out = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }

  /**
   * Stops reading and releases the connection. Safe to call from outside a
   * running `for await` (a barge-in callback): the loop then ends after the
   * chunk it holds. When you read `body` with your own reader, cancel that
   * reader instead.
   */
  async cancel(): Promise<void> {
    await (this.reader ?? this.body).cancel().catch(() => undefined);
  }
}

/**
 * The Text-to-Speech API: text in, audio out.
 *
 * `synthesize()` returns one text's complete audio; `stream()` returns it as
 * the API generates it; `session()` opens a WebSocket session that speaks
 * text as it is written, for voice agents. Requests go to the client's
 * `ttsBaseUrl` (`https://tts.us.assemblyai.com` by default;
 * `https://tts.eu.assemblyai.com` keeps them in the EU).
 *
 * @example
 * ```ts
 * const client = new AssemblyAI({ apiKey: "..." });
 * const { audio } = await client.tts.synthesize({ text: "Hello.", voice_id: "aai-jane", container: "wav" });
 * writeFileSync("hello.wav", audio);
 * ```
 */
export class TextToSpeechService extends BaseService {
  private readonly serviceParams: BaseServiceParams;

  constructor(params: BaseServiceParams) {
    super(params);
    this.serviceParams = params;
  }

  /**
   * Speaks `request.text` and returns the complete audio.
   *
   * Nothing is sent back until the audio is complete, so a long text takes
   * several seconds and an API failure is always a `TextToSpeechError`,
   * never a cut response.
   *
   * On Node, the built-in `fetch` waits at most 300 seconds for the response
   * headers (undici's `headersTimeout`), whatever `options.timeout` says. For
   * longer requests use `stream()`, or raise that limit with
   * `setGlobalDispatcher(new Agent({ headersTimeout: 610_000 }))` from the
   * `undici` package.
   * @throws TextToSpeechError on any API refusal. A network failure or a
   * timeout rejects with the runtime's own error instead: a `TypeError`, a
   * `DOMException` named `TimeoutError` once `options.timeout` passes, or the
   * reason of `options.signal` (an `AbortError` unless you gave another).
   */
  async synthesize(
    request: TextToSpeechRequest,
    options: TextToSpeechRequestOptions = {},
  ): Promise<TextToSpeechResponse> {
    const deadline = requestDeadline(
      options.timeout ?? DEFAULT_SYNTHESIZE_TIMEOUT_MS,
      options.signal,
    );
    try {
      const response = await this.fetchResponse(ENDPOINT_SPEECH, {
        method: "POST",
        body: JSON.stringify({ ...request, stream: false }),
        signal: deadline.signal,
      });
      if (!response.ok) throw await speechErrorFromResponse(response);
      const audio = new Uint8Array(await response.arrayBuffer());
      const info = textToSpeechResponseInfo(response.headers);
      warnUnknownParams(info);
      return { ...info, audio };
    } finally {
      deadline.release();
    }
  }

  /**
   * Speaks `request.text` and returns the audio as it is generated.
   *
   * Resolves once the API has sent the first audio. The API commits to `200`
   * then, so a later failure cuts the body and the iteration throws. So does
   * a body that sends nothing for `options.readTimeout` (30 000 ms by
   * default) while the iteration waits for audio; the connection is then
   * released. `options.signal` keeps covering the body: aborting it stops
   * the download.
   *
   * The audio comes as a web `ReadableStream`, so the runtime needs a global
   * `ReadableStream` (React Native has none without a polyfill). Without
   * one, `stream()` rejects before sending anything; use `synthesize()`
   * there. A runtime with `ReadableStream` whose `fetch` gives no streamed
   * body gets the whole audio as one chunk once it has all arrived.
   * @throws TextToSpeechError if the API refuses the request before any audio,
   * or, with `retryable: false` and before any request, if the runtime has
   * no global `ReadableStream`.
   * A network failure or a timeout rejects with the runtime's own error
   * instead: a `TypeError`, a `DOMException` named `TimeoutError` once
   * `options.timeout` passes, or the reason of `options.signal`.
   */
  async stream(
    request: TextToSpeechRequest,
    options: TextToSpeechRequestOptions = {},
  ): Promise<TextToSpeechStream> {
    // Checked before sending, so a runtime that could not hand the audio
    // over is not billed for it.
    if (typeof ReadableStream !== "function") {
      throw new TextToSpeechError(
        "stream() needs web streams (a global ReadableStream), which this runtime does not have. Use synthesize() to get the whole audio, or install a ReadableStream polyfill.",
        { retryable: false },
      );
    }
    const deadline = requestDeadline(
      options.timeout ?? DEFAULT_STREAM_TIMEOUT_MS,
      options.signal,
    );
    let response: Response;
    try {
      response = await this.fetchResponse(ENDPOINT_SPEECH, {
        method: "POST",
        body: JSON.stringify({ ...request, stream: true }),
        signal: deadline.signal,
      });
    } catch (error) {
      deadline.release();
      throw error;
    }
    deadline.headersArrived();
    if (!response.ok) {
      try {
        throw await speechErrorFromResponse(response);
      } finally {
        deadline.release();
      }
    }
    const info = textToSpeechResponseInfo(response.headers);
    warnUnknownParams(info);
    if (!response.body || typeof response.body.getReader !== "function") {
      // A runtime without web streamed bodies: hand the whole audio over as one chunk.
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await response.arrayBuffer());
      } finally {
        deadline.release();
      }
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
      return new TextToSpeechStream(info, body, { signal: options.signal });
    }
    // Lock the body now and read it through this reader. Node 20+ fetch
    // cancels the unlocked body of a garbage-collected `Response`, which
    // would end an iteration that starts after an `await` with no audio.
    // The request stays tied to `options.signal` until the body ends, however
    // it ends, also when the caller reads `body` with a reader of its own.
    const reader = response.body.getReader();
    // `pull` runs only while a read of `body` waits (`highWaterMark: 0`), so
    // the read timeout counts that wait and never the caller's playback.
    const readTimeout = options.readTimeout ?? DEFAULT_READ_TIMEOUT_MS;
    const stalled = () =>
      new TextToSpeechError(
        `The response was cut before the audio was complete: no audio for ${readTimeout} ms. Retry the request.`,
        { status: 200, requestId: info.requestId, retryable: true },
      );
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          let result: ReadableStreamReadResult<Uint8Array>;
          try {
            result = await readWithin(reader, readTimeout, stalled);
          } catch (error) {
            deadline.release();
            throw error;
          }
          if (result.done) {
            deadline.release();
            controller.close();
          } else controller.enqueue(result.value);
        },
        cancel: (reason) => {
          deadline.release();
          return reader.cancel(reason);
        },
      },
      { highWaterMark: 0 },
    );
    return new TextToSpeechStream(info, body, { signal: options.signal });
  }

  /**
   * Creates a WebSocket session; nothing connects until `connect()`.
   *
   * The client's API key is used when `params` has neither `token` nor
   * `apiKey`; the session host follows the client's `ttsBaseUrl` unless
   * `websocketBaseUrl` is given. In a browser, open the session with
   * `new TextToSpeechSession({ token })` instead, so the page needs no client
   * and no API key.
   */
  session(params: TextToSpeechSessionParams = {}): TextToSpeechSession {
    const sessionParams = { ...params };
    if (!sessionParams.token && !sessionParams.apiKey) {
      sessionParams.apiKey = this.serviceParams.apiKey;
    }
    if (!sessionParams.websocketBaseUrl && this.serviceParams.baseUrl) {
      const base = new URL(this.serviceParams.baseUrl);
      base.protocol = base.protocol === "http:" ? "ws:" : "wss:";
      base.pathname = base.pathname.replace(/\/$/, "") + "/v1/ws";
      sessionParams.websocketBaseUrl = base.toString();
    }
    return new TextToSpeechSession(sessionParams, {
      userAgent: this.userAgent,
    });
  }

  /**
   * Mints a temporary token for a session or an HTTP request made from a
   * user's device, where the API key must not go. Call this server-side,
   * once per connection (reconnects included) and per HTTP request.
   *
   * The token is minted on the token host of the client's zone:
   * `https://token.eu.assemblyai.com` when `ttsBaseUrl` is
   * `https://tts.eu.assemblyai.com`, `https://token.us.assemblyai.com` when
   * it is `https://tts.us.assemblyai.com` (the default), and
   * `https://token.assemblyai.com` for any other host. A token works in
   * every zone.
   * @param options.tokenBaseUrl - The token host to use instead.
   * @throws TextToSpeechError if the token service refuses the request; its
   * message is the service's reason, such as `Invalid API key`.
   */
  async createTemporaryToken(
    params: TextToSpeechTokenParams,
    options: { tokenBaseUrl?: string } = {},
  ): Promise<string> {
    const search = new URLSearchParams({ product: "tts" });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null)
        search.append(key, String(value));
    });
    const base = (
      options.tokenBaseUrl ?? zoneTokenBaseUrl(this.serviceParams.baseUrl)
    ).replace(/\/$/, "");
    const response = await this.fetchResponse(
      `${base}/v1/token?${search.toString()}`,
      {
        method: "GET",
      },
    );
    if (!response.ok) throw await speechErrorFromResponse(response);
    const data = (await response.json()) as { token: string };
    return data.token;
  }
}
