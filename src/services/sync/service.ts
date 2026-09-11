import { readFile } from "#fs";
import { BaseService } from "../base";
import {
  BaseServiceParams,
  SyncAudioInput,
  SyncLiveAudioInput,
  SyncLiveOptions,
  SyncTranscribeOptions,
  SyncTranscriptResponse,
  SyncTranscriptionConfig,
} from "../..";
import { defaultSyncSpeechModel } from "../../types/sync";
import { SyncTranscriptError } from "../../utils/errors/sync";
import { getPath } from "../../utils/path";
import {
  basename,
  dataUrlToBytes,
  deadlineSignal,
  errorFromResponse,
  extname,
  isAsyncIterable,
  isWebReadableStream,
  liveBody,
  liveChunks,
  multipartBoundary,
  multipartClosing,
  multipartHead,
  readAsyncIterable,
  readStream,
  resolveFormat,
} from "../../utils/live";
import { SyncLiveSession, checkLiveInput } from "./live";

// The one endpoint the client posts audio to. The service also serves it at
// /v1/transcribe/stream.
const transcribeLiveEndpoint = "/v1/transcribe/live";
const warmEndpoint = "/v1/warm";
const modelHeader = "X-AAI-Model";
// A fetch deadline spans the whole request, upload included, so this must
// clear the 120 s audio cap plus the final segment. It is the default for
// every transcription request.
const defaultLiveTimeoutMs = 180_000;
const warmTimeoutMs = 10_000;
// Caps mirror the sync service's `config` part. `prompt` and
// `keyterms_prompt` over their caps are rejected; `conversation_context` over
// its caps is trimmed, oldest turns first.
const maxPromptLength = 6000;
const maxKeytermsPromptLength = 8000;
const maxKeytermsCount = 100;
const maxContextTurns = 500;
const maxContextLength = 16000;
// The sync route decodes a WAV container or raw S16LE PCM, so no extension
// maps to a container content type of its own.
const contentTypes: Record<string, string> = {};
// What to call the config in the message when raw PCM is missing a field.
const configName = "the config";

/**
 * The synchronous transcription service: audio in, transcript out, one
 * connection.
 *
 * Unlike `client.transcripts` (which submits a job to the async API and
 * polls for completion), `SyncTranscriber` posts audio over a live upload to
 * the sync API and returns the finished transcript in the HTTP response.
 * There is no job id or status to poll. `transcribe()` accepts a local file
 * path, raw audio bytes, a Blob, or a readable stream — but not a URL — and
 * sends it as a single chunk over the same connection `transcribeLive()` and
 * `openLive()` use for audio still being produced.
 */
export class SyncTranscriber extends BaseService {
  /**
   * Create a new synchronous transcription service.
   * @param params - The parameters to use for the service.
   */
  constructor(params: BaseServiceParams) {
    super(params);
  }

  /**
   * Transcribe audio and return the finished transcript in one request.
   *
   * The audio travels as a single chunk over the same live upload
   * `transcribeLive()` uses — this is the ergonomic shape for audio you
   * already hold whole, rather than audio still being produced.
   * @param audio - A local file path, raw audio bytes, a Blob, or a readable
   * stream. Raw PCM also requires `sample_rate` and `channels` on the config.
   * @param config - Options for this transcription request.
   * @param options - Client-side options: the request deadline and an
   * optional abort signal.
   * @returns A promise that resolves to the finished transcript.
   * @throws Error when `audio` is a URL, when raw PCM is missing
   * `sample_rate` or `channels`, or when `prompt` or `keyterms_prompt`
   * exceeds its cap.
   * @throws SyncTranscriptError when the request fails.
   */
  async transcribe(
    audio: SyncAudioInput,
    config: SyncTranscriptionConfig = {},
    options: SyncTranscribeOptions = {},
  ): Promise<SyncTranscriptResponse> {
    const { bytes, filename, contentType } = await resolveAudio(audio, config);
    const signal = deadlineSignal(
      options.timeout ?? defaultLiveTimeoutMs,
      options.signal,
    );
    return await this.postLive(singleChunk(bytes), audio, config, signal, {
      filename,
      contentType,
    });
  }

  /**
   * Transcribe audio uploaded as it is produced.
   *
   * For audio that is still being produced — a live microphone, an
   * in-progress call — this starts the request immediately and uploads
   * chunks as they arrive, so authorization, the upload and every speech
   * segment but the last resolve while the caller is still recording. What
   * is left to wait for once they stop is the final segment. Audio already
   * held whole travels the same connection as a single chunk in
   * `transcribe()`, the ergonomic shape for that case.
   *
   * The saving only pays off when the audio is genuinely still being
   * produced; audio you already hold whole belongs in `transcribe()`. It
   * also needs enough audio to have segments to release early; below
   * roughly a minute only the elided upload counts. The same 120 s audio
   * cap applies.
   *
   * The caller must keep producing: an upload that goes silent for long
   * enough is aborted server-side. Stop by ending the stream, not by pausing
   * it. For sources that deliver audio through a callback rather than a
   * stream, see `openLive()`.
   * @param audio - An async iterable (Node streams included), a sync
   * iterable, or a web `ReadableStream` of audio chunks. Raw PCM also
   * requires `sample_rate` and `channels` on the config. Audio you already
   * hold whole belongs in `transcribe()`.
   * @param config - Options for this transcription request.
   * @param options - Client-side options: the request deadline, which must
   * cover the recording, and an optional abort signal.
   * @returns A promise that resolves to the finished transcript.
   * @throws TypeError when `audio` is bytes, a Blob or a path rather than a
   * stream, or when a chunk is not bytes.
   * @throws SyncTranscriptError when the request fails. Auth, rate-limit and
   * capacity failures can surface part-way through the upload. Anything the
   * producer throws propagates unchanged; the connection is dropped.
   */
  async transcribeLive(
    audio: SyncLiveAudioInput,
    config: SyncTranscriptionConfig = {},
    options: SyncLiveOptions = {},
  ): Promise<SyncTranscriptResponse> {
    checkLiveInput(audio);
    const signal = deadlineSignal(
      options.timeout ?? defaultLiveTimeoutMs,
      options.signal,
    );
    return await this.postLive(liveChunks(audio), audio, config, signal);
  }

  /**
   * Open a live upload that audio is pushed into.
   *
   * The push-style counterpart of `transcribeLive()`, for sources that
   * deliver audio through a callback rather than a stream. The request starts
   * immediately; call `session.write(chunk)` from the callback, then
   * `await session.result()` for the transcript once the speaker stops. See
   * `SyncLiveSession`.
   * @param config - Options for this transcription request. Raw PCM requires
   * `sample_rate` and `channels`.
   * @param options - Client-side options: the request deadline, which must
   * cover the recording.
   * @returns The open session.
   * @example
   * ```ts
   * const session = client.sync.openLive({ sample_rate: 16000, channels: 1 });
   * mic.on("data", (chunk) => session.write(chunk));
   * mic.on("end", () => session.close());
   * const { text } = await session.result();
   * ```
   */
  openLive(
    config: SyncTranscriptionConfig = {},
    options: SyncLiveOptions = {},
  ): SyncLiveSession {
    return new SyncLiveSession((chunks, abortSignal) =>
      this.postLive(
        chunks,
        undefined,
        config,
        deadlineSignal(options.timeout ?? defaultLiveTimeoutMs, abortSignal),
      ),
    );
  }

  /**
   * Post a live upload whose audio arrives from `chunks`. `source` is the
   * caller's original input, consulted only for a file name when `format` is
   * not already resolved.
   */
  private async postLive(
    chunks: AsyncIterable<Uint8Array>,
    source: unknown,
    config: SyncTranscriptionConfig,
    signal: AbortSignal,
    format?: { filename: string; contentType: string },
  ): Promise<SyncTranscriptResponse> {
    const { filename, contentType } =
      format ?? resolveLiveFormat(source, config);
    const boundary = multipartBoundary();
    const body = liveBody({
      head: multipartHead({
        boundary,
        config: buildConfigJson(config),
        filename,
        contentType,
      }),
      chunks,
      closing: multipartClosing(boundary),
    });

    let response: Response;
    try {
      response = await this.fetchResponse(transcribeLiveEndpoint, {
        method: "POST",
        body: body.stream,
        headers: {
          [modelHeader]: config.model ?? defaultSyncSpeechModel,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        // Required by fetch for a streaming request body; it is what lets the
        // request start before the audio exists.
        duplex: "half",
        signal,
      } as RequestInit);
    } catch (error) {
      // fetch reports a failed request body as an opaque "fetch failed";
      // surface what the producer actually threw.
      throw body.error ?? error;
    }
    if (response.status !== 200) {
      // The server can reject while the upload is still in flight (auth,
      // rate limit, capacity). fetch resolves with the status at once but
      // withholds the response body until the request body ends, so end it
      // now rather than streaming the rest of a rejected recording.
      body.finish();
      throw await syncError(response);
    }
    return (await response.json()) as SyncTranscriptResponse;
  }

  /**
   * Open the connection to the sync API ahead of time.
   *
   * The sync API is a single request/response, so a `transcribe()` that
   * opens its connection on demand pays the full DNS + TCP + TLS handshake
   * on the critical path. Call `warm()` as soon as you know audio is coming —
   * typically while the clip is still being recorded — so the next
   * `transcribe()` reuses the already-open connection. `warm()` is idempotent
   * and cheap; call it shortly before `transcribe()` so the pooled connection
   * hasn't idled out.
   * @param params - Optionally the model to route the probe to, so the warmed
   * connection lands on the same backend as the eventual transcription.
   * @returns A promise that resolves to `true` once the connection is open
   * (any HTTP response — even a non-200 — means the socket is
   * established), or `false` if the connection could not be opened.
   */
  async warm(params?: { model?: string }): Promise<boolean> {
    try {
      await this.fetchResponse(warmEndpoint, {
        method: "GET",
        headers: { [modelHeader]: params?.model ?? defaultSyncSpeechModel },
        signal: AbortSignal.timeout(warmTimeoutMs),
      });
      return true;
    } catch {
      return false;
    }
  }
}

type ResolvedAudio = {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
};

/** Presents audio that is already complete as the upload's one chunk. */
async function* singleChunk(bytes: Uint8Array): AsyncGenerator<Uint8Array> {
  yield bytes;
}

/**
 * Read the audio input into bytes and decide its multipart content type.
 *
 * PCM is selected when the source has a `.pcm`/`.raw` extension or when
 * `sample_rate`/`channels` are set on the config (the fields the sync API
 * requires only for raw PCM) — and both must then be present. Everything
 * else is treated as a WAV container. URLs are rejected — the sync API has
 * no URL ingestion.
 */
async function resolveAudio(
  input: SyncAudioInput,
  config: SyncTranscriptionConfig,
): Promise<ResolvedAudio> {
  let bytes: Uint8Array;
  let filename: string | undefined;
  let suffix = "";

  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) {
      throw new Error(
        "SyncTranscriber does not accept URLs. Pass a local file path or " +
          "audio bytes, or use client.transcripts for URL/async transcription.",
      );
    }
    if (input.startsWith("data:")) {
      bytes = dataUrlToBytes(input);
    } else {
      const path = getPath(input) ?? input;
      bytes = await readStream(await readFile(path));
      filename = basename(path);
      suffix = extname(filename);
    }
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (input instanceof Blob) {
    bytes = new Uint8Array(await input.arrayBuffer());
    // File instances carry a name; the File global itself needs Node >= 20.
    const name = (input as { name?: string }).name;
    if (name) {
      filename = basename(name);
      suffix = extname(filename);
    }
  } else if (isWebReadableStream(input)) {
    bytes = await readStream(input);
  } else if (isAsyncIterable(input)) {
    bytes = await readAsyncIterable(input);
    // fs.ReadStream carries the path it was opened from.
    const path = (input as { path?: string | Buffer }).path;
    if (typeof path === "string") {
      filename = basename(path);
      suffix = extname(filename);
    }
  } else {
    throw new TypeError("unsupported audio input type");
  }

  return {
    bytes,
    ...resolveFormat(config, suffix, filename, contentTypes, configName),
  };
}

/**
 * The format for a live source, which has no bytes to inspect: only the
 * config and, for an `fs.ReadStream`, the path it was opened from.
 */
function resolveLiveFormat(
  source: unknown,
  config: SyncTranscriptionConfig,
): { filename: string; contentType: string } {
  const path = (source as { path?: unknown } | undefined)?.path;
  const filename = typeof path === "string" ? basename(path) : undefined;
  return resolveFormat(
    config,
    filename ? extname(filename) : "",
    filename,
    contentTypes,
    configName,
  );
}

/**
 * Serialize the config to the JSON `config` part, validating and normalizing
 * field values to match the server's caps. The routing `model` is never
 * included — it travels in the `X-AAI-Model` header. Returns `undefined`
 * when there are no options; the multipart head then sends an empty `{}`
 * part.
 */
function buildConfigJson(
  config: SyncTranscriptionConfig,
): Record<string, unknown> | undefined {
  if (config.prompt !== undefined && config.prompt.length > maxPromptLength) {
    throw new Error(
      `prompt exceeds ${maxPromptLength} characters (got ${config.prompt.length})`,
    );
  }

  const json: Record<string, unknown> = {};
  if (config.prompt !== undefined) json["prompt"] = config.prompt;
  const keytermsPrompt = normalizeKeytermsPrompt(config.keyterms_prompt);
  if (keytermsPrompt) json["keyterms_prompt"] = keytermsPrompt;
  const context = normalizeConversationContext(config.conversation_context);
  if (context) json["conversation_context"] = context;
  if (config.language_codes !== undefined)
    json["language_codes"] = config.language_codes;
  if (config.sample_rate !== undefined)
    json["sample_rate"] = config.sample_rate;
  if (config.channels !== undefined) json["channels"] = config.channels;
  if (config.timestamps !== undefined) json["timestamps"] = config.timestamps;

  return Object.keys(json).length > 0 ? json : undefined;
}

function normalizeKeytermsPrompt(
  keytermsPrompt?: string[],
): string[] | undefined {
  if (!keytermsPrompt) return undefined;
  const terms = keytermsPrompt
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
  if (terms.length > maxKeytermsCount) {
    throw new Error(
      `keyterms_prompt exceeds ${maxKeytermsCount} terms (got ${terms.length})`,
    );
  }
  const total = terms.reduce((sum, term) => sum + term.length, 0);
  if (total > maxKeytermsPromptLength) {
    throw new Error(
      `keyterms_prompt exceeds ${maxKeytermsPromptLength} characters (got ${total})`,
    );
  }
  return terms.length > 0 ? terms : undefined;
}

function normalizeConversationContext(
  context?: string | string[],
): string[] | undefined {
  if (context === undefined) return undefined;
  let turns = (typeof context === "string" ? [context] : context)
    .map((turn) => turn.trim())
    .filter((turn) => turn.length > 0);
  let total = turns.reduce((sum, turn) => sum + turn.length, 0);
  // Over-cap context is trimmed oldest-first, never rejected.
  while (
    turns.length > 0 &&
    (turns.length > maxContextTurns || total > maxContextLength)
  ) {
    total -= turns[0].length;
    turns = turns.slice(1);
  }
  return turns.length > 0 ? turns : undefined;
}

/**
 * Build a SyncTranscriptError from a non-200 response.
 * @param response - The failed response.
 * @returns A promise that resolves to the error to throw.
 */
async function syncError(response: Response): Promise<SyncTranscriptError> {
  return await errorFromResponse(
    response,
    SyncTranscriptError,
    "sync transcription",
  );
}
