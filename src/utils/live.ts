/**
 * Multipart framing, streaming request bodies and the push-style session
 * behind every live upload route.
 *
 * A buffered request hands fetch a `FormData` and lets it encode the whole
 * body up front. A live upload cannot: the audio does not exist yet when the
 * request starts. This module emits the framing itself as a `ReadableStream`,
 * so the `config` part goes out immediately and audio follows as it arrives.
 *
 * Part order is significant and is enforced here by construction. The server
 * decodes audio as it lands, so it needs `sample_rate` and `channels` before
 * the first audio byte: `config` precedes `audio`, and is always present (an
 * empty object when there are no options), because the routes reject a body
 * whose audio no config part came before.
 *
 * Nothing here knows which product it is serving: the caller supplies the
 * config JSON, the error class and the extension-to-Content-Type map.
 */

const encoder = new TextEncoder();

/**
 * Generates a multipart boundary. Random alphanumerics behind a fixed prefix,
 * as `FormData` implementations do; `Math.random` rather than Web Crypto
 * because `globalThis.crypto` is flagged on Node 18, which is still supported.
 * @returns The boundary token, without the leading dashes.
 */
export function multipartBoundary(): string {
  let token = "";
  while (token.length < 32) token += Math.random().toString(36).slice(2);
  return `----assemblyai-${token.slice(0, 32)}`;
}

/**
 * Escape a value for a quoted `Content-Disposition` parameter, as
 * `FormData` serialization does: `"` becomes `%22`, CR and LF become `%0D`
 * and `%0A`, so a file name cannot break out of the part header.
 */
function escapeFormParam(value: string): string {
  return value.replace(/"/g, "%22").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/**
 * The bytes that precede the first audio byte: the `config` part in full,
 * then the `audio` part's headers.
 * @param params - The boundary, the config JSON (an empty object is sent when
 * it is `undefined`), and the audio part's file name and content type.
 * @returns The encoded head of the multipart body.
 */
export function multipartHead(params: {
  boundary: string;
  config: Record<string, unknown> | undefined;
  filename: string;
  contentType: string;
}): Uint8Array {
  const { boundary, config, filename, contentType } = params;
  return encoder.encode(
    `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="config"\r\n' +
      "Content-Type: application/json\r\n\r\n" +
      JSON.stringify(config ?? {}) +
      "\r\n" +
      `--${boundary}\r\n` +
      "Content-Disposition: form-data; " +
      `name="audio"; filename="${escapeFormParam(filename)}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
}

/**
 * The terminating boundary.
 * @param boundary - The boundary the body was framed with.
 * @returns The encoded tail of the multipart body.
 */
export function multipartClosing(boundary: string): Uint8Array {
  return encoder.encode(`\r\n--${boundary}--\r\n`);
}

/**
 * Coerce one produced chunk to bytes, or throw naming the mistake. A string
 * is the likely sign of a stream opened in text mode or a producer yielding
 * text; it would otherwise fail deep inside the transport.
 * @param chunk - One piece produced by the caller's audio source.
 * @returns The chunk as bytes.
 * @throws TypeError when the chunk is not bytes.
 */
export function asBytes(chunk: unknown): Uint8Array {
  if (chunk instanceof Uint8Array) return chunk;
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  if (typeof chunk === "string") {
    throw new TypeError(
      "live audio chunks must be bytes (Uint8Array, Buffer or ArrayBuffer), " +
        "not strings. Read the source in binary mode or encode the output.",
    );
  }
  throw new TypeError(
    `live audio chunks must be bytes (Uint8Array, Buffer or ArrayBuffer), got ${describe(chunk)}`,
  );
}

/**
 * A short name for a value, for error messages that report what arrived.
 * @param value - The value to name.
 * @returns Its constructor name, or its primitive type.
 */
export function describe(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  return (value as object).constructor?.name ?? "object";
}

/**
 * Whether `input` is a web `ReadableStream`.
 * @param input - The value to test.
 * @returns `true` when it exposes `getReader()`.
 */
export function isWebReadableStream(
  input: unknown,
): input is ReadableStream<Uint8Array> {
  return typeof (input as ReadableStream<Uint8Array>)?.getReader === "function";
}

/**
 * Whether `input` can be iterated, synchronously or asynchronously.
 * @param input - The value to test.
 * @returns `true` when it has `Symbol.iterator` or `Symbol.asyncIterator`.
 */
export function isIterable(input: unknown): boolean {
  const candidate = input as {
    [Symbol.asyncIterator]?: unknown;
    [Symbol.iterator]?: unknown;
  };
  return (
    typeof candidate?.[Symbol.asyncIterator] === "function" ||
    typeof candidate?.[Symbol.iterator] === "function"
  );
}

/**
 * Whether `input` is an async iterable, Node streams included.
 * @param input - The value to test.
 * @returns `true` when it has `Symbol.asyncIterator`.
 */
export function isAsyncIterable(
  input: unknown,
): input is AsyncIterable<Uint8Array> {
  return (
    typeof (input as AsyncIterable<Uint8Array>)?.[Symbol.asyncIterator] ===
    "function"
  );
}

/**
 * Audio delivered piece by piece: an async iterable (Node streams included),
 * a sync iterable, or a web `ReadableStream` of `Uint8Array` chunks.
 */
export type LiveChunkSource =
  | AsyncIterable<Uint8Array>
  | Iterable<Uint8Array>
  | ReadableStream<Uint8Array>
  | NodeJS.ReadableStream;

/**
 * Yields the pieces of any accepted live input, coerced to bytes.
 * @param input - The caller's stream or iterable of audio chunks.
 * @returns An async generator over the chunks, in order.
 * @throws TypeError when a produced chunk is not bytes.
 */
export async function* liveChunks(
  input: LiveChunkSource,
): AsyncGenerator<Uint8Array> {
  if (isWebReadableStream(input)) {
    const reader = input.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield asBytes(value);
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    for await (const chunk of input as AsyncIterable<unknown>) {
      yield asBytes(chunk);
    }
  }
}

/**
 * A streaming request body and the handles the transport layer needs on it.
 * @internal
 */
export type LiveBody = {
  /** The body to hand to fetch. */
  stream: ReadableStream<Uint8Array>;
  /**
   * What the producer threw, if the body failed. fetch reports a failed body
   * as an opaque "fetch failed"; this keeps the original so it can be
   * rethrown unchanged.
   */
  error: unknown;
  /**
   * End the upload now, without waiting for the producer: the terminating
   * boundary goes out on the next pull. Used when the server has already
   * responded, since it withholds the response body until the request body
   * ends, and there is no point sending more audio to a request that has
   * been rejected.
   */
  finish(): void;
};

/**
 * The request body: framing head, then each non-empty audio chunk as it is
 * produced, then the terminating boundary. Empty chunks are dropped rather
 * than sent, since a zero-length chunk would end a chunked body early.
 * @param params - The framing head, the chunk producer, and the closing
 * boundary.
 * @returns The body stream, plus the producer's error and an early finish.
 */
export function liveBody(params: {
  head: Uint8Array;
  chunks: AsyncIterable<Uint8Array>;
  closing: Uint8Array;
}): LiveBody {
  const { head, chunks, closing } = params;
  const iterator = chunks[Symbol.asyncIterator]();
  let headSent = false;
  let finished = false;
  let finish: () => void = () => undefined;
  const finishing = new Promise<{ done: true; value: undefined }>((resolve) => {
    finish = () => {
      finished = true;
      resolve({ done: true, value: undefined });
    };
  });

  const body: LiveBody = {
    error: undefined,
    finish: () => finish(),
    stream: new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (!headSent) {
          headSent = true;
          controller.enqueue(head);
          return;
        }
        try {
          for (;;) {
            // A producer blocked waiting for audio must not hold the request
            // open once finish() has been called, so race it.
            const next = finished
              ? { done: true as const, value: undefined }
              : await Promise.race([iterator.next(), finishing]);
            if (next.done) {
              if (finished) void iterator.return?.().catch(() => undefined);
              controller.enqueue(closing);
              controller.close();
              return;
            }
            if (next.value.byteLength > 0) {
              controller.enqueue(next.value);
              return;
            }
          }
        } catch (error) {
          body.error = error;
          throw error;
        }
      },
      async cancel() {
        await iterator.return?.();
      },
    }),
  };
  return body;
}

/**
 * A producer that audio is pushed into: `push()` from any callback, `end()`
 * when the audio is over. Iterating it yields the chunks in order and
 * finishes after `end()`.
 */
class ChunkQueue implements AsyncIterable<Uint8Array> {
  private readonly items: Uint8Array[] = [];
  private ended = false;
  private wake: (() => void) | undefined;

  push(chunk: Uint8Array): void {
    this.items.push(chunk);
    this.wake?.();
  }

  end(): void {
    this.ended = true;
    this.wake?.();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
    for (;;) {
      if (this.items.length > 0) {
        yield this.items.shift()!;
        continue;
      }
      if (this.ended) return;
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
      this.wake = undefined;
    }
  }
}

/**
 * Runs the upload from a producer, returning its outcome.
 * @typeParam TResult - The product's response type.
 * @internal
 */
export type LiveStarter<TResult> = (
  chunks: AsyncIterable<Uint8Array>,
  signal: AbortSignal,
) => Promise<TResult>;

/**
 * A live upload that audio is pushed into.
 *
 * The request starts the moment the session opens; `write()` hands it audio,
 * `close()` ends the audio, and `result()` resolves with the response. Built
 * for callback-driven sources: a microphone library, a WebRTC track, a
 * telephony media stream, a websocket handler receiving frames. Sources that
 * already are streams or async iterables are handed to the product's
 * `transcribeLive()` instead.
 * @typeParam TResult - The product's response type.
 */
export class LiveSession<TResult> {
  private readonly queue = new ChunkQueue();
  private readonly controller = new AbortController();
  private readonly outcome: Promise<TResult>;
  private isClosed = false;
  private isAborted = false;
  private isSettled = false;

  /**
   * @param start - Begins the upload from the session's producer and returns
   * the promise that carries its outcome. Supplied by the service.
   * @internal
   */
  constructor(start: LiveStarter<TResult>) {
    this.outcome = start(this.queue, this.controller.signal);
    // A rejection is delivered through result(); it must not also surface as
    // an unhandled rejection when the caller has not awaited yet.
    const settled = () => {
      this.isSettled = true;
    };
    this.outcome.then(settled, settled);
  }

  /**
   * Whether the audio has ended, by `close()`, `result()` or `abort()`.
   */
  get closed(): boolean {
    return this.isClosed;
  }

  /**
   * Queue a piece of audio for upload. Never blocks, so it is safe to call
   * from an audio library's capture callback.
   *
   * Once the audio has ended — by `close()`, `result()`, `abort()`, or the
   * request settling on its own — a late write is dropped, not thrown.
   * `write()` is meant to be called from a capture callback that the caller
   * may not have stopped in lockstep with teardown, and throwing into that
   * callback can take down the process; silently ignoring the trailing chunks
   * is safer. A genuine type error is still surfaced at once, while the
   * session is open.
   * @param chunk - Audio bytes, in order: a `Uint8Array`, `Buffer` or
   * `ArrayBuffer`.
   * @throws TypeError when `chunk` is not bytes and the session is still open.
   */
  write(chunk: Uint8Array | ArrayBuffer): void {
    if (this.isClosed || this.isSettled) return;
    const bytes = asBytes(chunk);
    if (bytes.byteLength > 0) this.queue.push(bytes);
  }

  /**
   * End the audio. The server transcribes what was sent and `result()`
   * resolves with it. Idempotent, and never blocks.
   */
  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    this.queue.end();
  }

  /**
   * Wait for the result, ending the audio first if it is still open.
   * @returns A promise that resolves to the finished response.
   * @throws Error when the request failed — including a rejection the server
   * sent while the upload was still in flight — or when the session was
   * aborted.
   */
  async result(): Promise<TResult> {
    if (this.isAborted) {
      throw new Error("the live session was aborted; there is no result");
    }
    this.close();
    return await this.outcome;
  }

  /**
   * Drop the request without a result. The connection is closed and nothing
   * the server may still return is kept; `result()` rejects afterwards.
   * Idempotent, and a no-op once the request has completed.
   * @returns A promise that resolves once the request has been let go of.
   */
  async abort(): Promise<void> {
    // A no-op once the request has finished: the response (or its error) is
    // already available through result(), so aborting must not mask it.
    if (this.isAborted || this.isSettled) return;
    this.isAborted = true;
    this.isClosed = true;
    this.queue.end();
    this.controller.abort();
    try {
      await this.outcome;
    } catch {
      // The request was dropped, or had already failed; neither is reported
      // from abort().
    }
  }

  /**
   * A `WritableStream` that feeds this session, for piping a web stream of
   * audio into it: `source.pipeTo(session.stream())`. Closing the writable
   * closes the session; aborting it aborts the session.
   * @returns The writable end of the session.
   */
  stream(): WritableStream<Uint8Array> {
    return new WritableStream<Uint8Array>({
      write: (chunk) => this.write(chunk),
      close: () => this.close(),
      abort: () => this.abort(),
    });
  }
}

/**
 * Build a product error from a non-200 response. The primary format is an
 * RFC 9457 problem-details body (`status`/`title`/`detail`); legacy
 * `{error_code, message}` and `{detail}`-only bodies are also accepted.
 * @typeParam TError - The product's error class.
 * @param response - The failed response, whose body is read here.
 * @param factory - The error class to construct.
 * @param label - What to call the request in the fallback message, e.g.
 * `"sync transcription"`.
 * @returns A promise that resolves to the constructed error.
 */
export async function errorFromResponse<TError extends Error>(
  response: Response,
  factory: new (
    message: string,
    status?: number,
    errorCode?: string,
    retryAfter?: number,
  ) => TError,
  label: string,
): Promise<TError> {
  let errorCode: string | undefined;
  let message: string | undefined;

  const text = await response.text();
  try {
    const body = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      if (typeof body.error_code === "string") errorCode = body.error_code;
      if (errorCode === undefined && typeof body.title === "string") {
        errorCode = body.title.toLowerCase().replace(/ /g, "_");
      }
      if (typeof body.detail === "string") message = body.detail;
      else if (typeof body.message === "string") message = body.message;
    }
  } catch {
    if (text) message = text;
  }
  if (!message) {
    message = `${label} failed with status ${response.status}`;
  }

  const retryHeader = response.headers.get("retry-after");
  const retryAfter =
    retryHeader && /^\d+$/.test(retryHeader)
      ? parseInt(retryHeader, 10)
      : undefined;

  return new factory(message, response.status, errorCode, retryAfter);
}

/** Extensions that signal raw S16LE PCM rather than a container format. */
const pcmSuffixes = [".pcm", ".raw"];

/** Content type used when the extension is unknown or absent. */
const defaultContentType = "audio/wav";

/**
 * Decide the multipart file name and content type for the audio part.
 *
 * PCM is selected when `suffix` is a PCM extension or when
 * `sample_rate`/`channels` are set on the config (the fields these APIs
 * require only for raw PCM), and both must then be present. Any other suffix
 * takes the content type `contentTypes` maps it to, and `audio/wav` when it
 * is unknown or absent. Needs no audio bytes, so it serves a live upload as
 * well as a buffered one.
 * @param config - The request config, read for `sample_rate` and `channels`.
 * @param suffix - The source's lowercased file extension, with the dot, or
 * `""`.
 * @param filename - The name for the multipart part; defaulted when absent.
 * @param contentTypes - Lowercased extension (with the dot) to content type.
 * @param configName - What to call the config in the error message.
 * @returns The file name and content type for the audio part.
 * @throws Error when the audio is raw PCM and either PCM field is missing.
 */
export function resolveFormat(
  config: { sample_rate?: number; channels?: number },
  suffix: string,
  filename: string | undefined,
  contentTypes: Record<string, string>,
  configName: string,
): { filename: string; contentType: string } {
  const wantsPcm =
    config.sample_rate !== undefined || config.channels !== undefined;
  const isPcm = pcmSuffixes.includes(suffix) || wantsPcm;
  if (
    isPcm &&
    (config.sample_rate === undefined || config.channels === undefined)
  ) {
    throw new Error(
      `raw PCM audio requires both sample_rate and channels in ${configName}`,
    );
  }

  const contentType = isPcm
    ? "audio/pcm"
    : (contentTypes[suffix] ?? defaultContentType);
  return {
    filename: filename ?? (isPcm ? "audio.pcm" : "audio.wav"),
    contentType,
  };
}

/**
 * A signal that aborts when `timeoutMs` elapses or when `external` aborts,
 * whichever comes first. `AbortSignal.any` would do this but needs Node 20.
 * @param timeoutMs - The deadline in milliseconds.
 * @param external - An optional caller-supplied signal.
 * @returns The combined signal.
 */
export function deadlineSignal(
  timeoutMs: number,
  external?: AbortSignal,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) return timeout;
  const controller = new AbortController();
  const forward = (signal: AbortSignal) => () =>
    controller.abort(signal.reason);
  if (external.aborted) controller.abort(external.reason);
  external.addEventListener("abort", forward(external), { once: true });
  timeout.addEventListener("abort", forward(timeout), { once: true });
  return controller.signal;
}

/**
 * The last segment of a path, whichever separator it uses.
 * @param path - The path to take the file name from.
 * @returns The file name.
 */
export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * The lowercased extension of a file name, with the dot.
 * @param filename - The file name to read the extension from.
 * @returns The extension, or `""` when there is none.
 */
export function extname(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex > 0 ? filename.slice(dotIndex).toLowerCase() : "";
}

/**
 * The bytes carried by a base64 `data:` URL.
 * @param dataUrl - The data URL to decode.
 * @returns The decoded bytes.
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Read a web stream to the end.
 * @param stream - The stream to drain.
 * @returns A promise that resolves to every byte it produced.
 */
export async function readStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return concatChunks(chunks);
}

/**
 * Read an async iterable to the end.
 * @param iterable - The iterable to drain.
 * @returns A promise that resolves to every byte it produced.
 */
export async function readAsyncIterable(
  iterable: AsyncIterable<Uint8Array>,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return concatChunks(chunks);
}

/**
 * Join chunks into one buffer.
 * @param chunks - The pieces, in order.
 * @returns The concatenated bytes.
 */
export function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
