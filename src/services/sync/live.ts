import { SyncLiveAudioInput, SyncTranscriptResponse } from "../..";

/**
 * Multipart framing and the push-style session for the live upload route.
 *
 * `transcribe()` hands fetch a `FormData` and lets it encode the whole body up
 * front. A live upload cannot: the audio does not exist yet when the request
 * starts. This module emits the framing itself as a `ReadableStream`, so the
 * `config` part goes out immediately and audio follows as it arrives.
 *
 * Part order is significant and is enforced here by construction. The server
 * decodes audio as it lands, so it needs `sample_rate` and `channels` before
 * the first audio byte: `config` precedes `audio`, and is always present (an
 * empty object when there are no options), because the route rejects a body
 * whose audio no config part came before.
 */

const encoder = new TextEncoder();

/**
 * Generates a multipart boundary. Random alphanumerics behind a fixed prefix,
 * as `FormData` implementations do; `Math.random` rather than Web Crypto
 * because `globalThis.crypto` is flagged on Node 18, which is still supported.
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

/** The terminating boundary. */
export function multipartClosing(boundary: string): Uint8Array {
  return encoder.encode(`\r\n--${boundary}--\r\n`);
}

/**
 * Coerce one produced chunk to bytes, or throw naming the mistake. A string
 * is the likely sign of a stream opened in text mode or a producer yielding
 * text; it would otherwise fail deep inside the transport.
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

function describe(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  return (value as object).constructor?.name ?? "object";
}

/**
 * Whether `input` is something the live route can drain: an async iterable
 * (Node streams included), a sync iterable of chunks, or a web
 * `ReadableStream`. Bytes, Blobs and paths are rejected by name: audio the
 * caller already holds whole belongs in `transcribe()`.
 */
export function checkLiveInput(input: unknown): void {
  if (
    input instanceof Uint8Array ||
    input instanceof ArrayBuffer ||
    input instanceof Blob
  ) {
    throw new TypeError(
      "transcribeLive() expects a stream or iterable of audio chunks, not " +
        "the whole audio. Audio you already hold belongs in transcribe(), " +
        "which is faster for it.",
    );
  }
  if (typeof input === "string") {
    throw new TypeError(
      "transcribeLive() expects a stream or iterable of audio chunks, not a " +
        "path. Open the file as a stream, or use transcribe() to let the SDK " +
        "read it.",
    );
  }
  if (!isWebReadableStream(input) && !isIterable(input)) {
    throw new TypeError(
      `unsupported live audio input type: ${describe(input)}`,
    );
  }
}

function isWebReadableStream(
  input: unknown,
): input is ReadableStream<Uint8Array> {
  return typeof (input as ReadableStream<Uint8Array>)?.getReader === "function";
}

function isIterable(input: unknown): boolean {
  const candidate = input as {
    [Symbol.asyncIterator]?: unknown;
    [Symbol.iterator]?: unknown;
  };
  return (
    typeof candidate?.[Symbol.asyncIterator] === "function" ||
    typeof candidate?.[Symbol.iterator] === "function"
  );
}

/** Yields the pieces of any accepted live input, coerced to bytes. */
export async function* liveChunks(
  input: SyncLiveAudioInput,
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
 * @internal
 */
export type LiveStarter = (
  chunks: AsyncIterable<Uint8Array>,
  signal: AbortSignal,
) => Promise<SyncTranscriptResponse>;

/**
 * A live upload that audio is pushed into.
 *
 * Returned by `client.sync.openLive()`. The request starts the moment the
 * session opens; `write()` hands it audio, `close()` ends the audio, and
 * `result()` resolves with the transcript. Built for callback-driven sources:
 * a microphone library, a WebRTC track, a telephony media stream, a websocket
 * handler receiving frames. Sources that already are streams or async
 * iterables can go straight to `client.sync.transcribeLive()` instead.
 *
 * Everything `transcribeLive()` says about when it pays off, the 120 s audio
 * cap, the server-side silence abort and errors surfacing mid-upload applies
 * here unchanged.
 *
 * @example
 * ```ts
 * const session = client.sync.openLive({ sample_rate: 16000, channels: 1 });
 * mic.on("data", (chunk) => session.write(chunk));
 * mic.on("end", () => session.close());
 * const { text } = await session.result();
 * ```
 */
export class SyncLiveSession {
  private readonly queue = new ChunkQueue();
  private readonly controller = new AbortController();
  private readonly outcome: Promise<SyncTranscriptResponse>;
  private isClosed = false;
  private isAborted = false;
  private isSettled = false;

  /** @internal Use `client.sync.openLive()`. */
  constructor(start: LiveStarter) {
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
   * is safer. (This is the one place the Node session diverges from the
   * Python `LiveSession`, which raises on a write after close.) A genuine
   * type error is still surfaced at once, while the session is open.
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
   * Wait for the transcript, ending the audio first if it is still open.
   * @returns A promise that resolves to the finished transcript.
   * @throws SyncTranscriptError when the request failed, including a
   * rejection the server sent while the upload was still in flight.
   * @throws Error when the session was aborted.
   */
  async result(): Promise<SyncTranscriptResponse> {
    if (this.isAborted) {
      throw new Error("the live session was aborted; there is no result");
    }
    this.close();
    return await this.outcome;
  }

  /**
   * Drop the request without a transcript. The connection is closed and
   * nothing the server may still return is kept; `result()` rejects
   * afterwards. Idempotent, and a no-op once the request has completed.
   * @returns A promise that resolves once the request has been let go of.
   */
  async abort(): Promise<void> {
    if (this.isAborted) return;
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
   */
  stream(): WritableStream<Uint8Array> {
    return new WritableStream<Uint8Array>({
      write: (chunk) => this.write(chunk),
      close: () => this.close(),
      abort: () => this.abort(),
    });
  }
}
