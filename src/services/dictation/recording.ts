import { DictationError } from "../../utils/errors/dictation";

/**
 * The most audio the buffered fallback keeps in memory: the size cap of the
 * buffered endpoint, `POST /v1/transcribe` (256 MB). A copy past it could
 * never be accepted there, so it is dropped rather than grown further.
 */
export const maxBufferedAudioBytes = 256 * 1024 * 1024;

/**
 * The error a fallback throws when the recording outgrows
 * `maxBufferedAudioBytes`: the same status and code the buffered endpoint
 * itself answers with for audio over its size cap.
 */
function overflowError(): DictationError {
  return new DictationError(
    `audio exceeds ${maxBufferedAudioBytes} bytes (256 MB), the most the ` +
      "buffered dictation fallback keeps",
    413,
    "audio_too_large",
  );
}

/**
 * Rejects with the signal's reason once it aborts; never settles otherwise.
 * The listener is removed by `dispose()`.
 */
function abortion(signal: AbortSignal): {
  promise: Promise<never>;
  dispose: () => void;
} {
  let dispose = () => undefined as void;
  const promise = new Promise<never>((_, reject) => {
    const onAbort = () =>
      reject(signal.reason ?? new Error("The operation was aborted."));
    signal.addEventListener("abort", onAbort, { once: true });
    dispose = () => signal.removeEventListener("abort", onAbort);
  });
  // Only ever observed through Promise.race; never an unhandled rejection.
  promise.catch(() => undefined);
  return { promise, dispose };
}

/**
 * The caller's audio source, with a copy kept of every chunk it produces.
 *
 * The live upload reads the source through `chunks`; the copy holds the same
 * bytes from the first one on, so that when the live request is refused for
 * being too long the whole recording can be sent again in one buffered
 * request. Only the audio is kept, never the multipart framing.
 *
 * The source has exactly one reader at a time: a chunk the live upload asked
 * for but gave up waiting on (when its body is ended early) is still
 * recorded, and is the first one `drain()` sees.
 * @internal
 */
export class AudioRecording {
  private readonly iterator: AsyncIterator<Uint8Array>;
  private recorded: Uint8Array[] = [];
  private recordedBytes = 0;
  private pending: Promise<IteratorResult<Uint8Array>> | undefined;
  private ended = false;
  private overflowed = false;
  private released = false;

  /**
   * The source as the live upload reads it. Ending this view early (the body
   * does so when the server answers mid-upload) leaves the source itself
   * open: whether it is released or drained is decided once the response is
   * known, by `release()` or `drain()`.
   */
  readonly chunks: AsyncIterable<Uint8Array>;

  /**
   * @param source - The caller's audio, already coerced to bytes.
   */
  constructor(source: AsyncIterable<Uint8Array>) {
    this.iterator = source[Symbol.asyncIterator]();
    this.chunks = {
      [Symbol.asyncIterator]: () => ({
        next: () => this.next(),
        return: async () => ({ done: true as const, value: undefined }),
      }),
    };
  }

  /**
   * The next chunk from the source, recorded before it is handed out. Calls
   * made while one is in flight share it, so no chunk is read twice or lost.
   */
  private next(): Promise<IteratorResult<Uint8Array>> {
    if (this.ended) return Promise.resolve({ done: true, value: undefined });
    if (!this.pending) {
      this.pending = this.iterator.next().then(
        (result) => {
          this.pending = undefined;
          if (result.done) this.ended = true;
          else this.record(result.value);
          return result;
        },
        (error: unknown) => {
          this.pending = undefined;
          this.ended = true;
          throw error;
        },
      );
    }
    return this.pending;
  }

  private record(chunk: Uint8Array): void {
    if (chunk.byteLength === 0 || this.released) return;
    this.recordedBytes += chunk.byteLength;
    if (this.overflowed) return;
    if (this.recordedBytes > maxBufferedAudioBytes) {
      // Past the buffered endpoint's cap the copy is useless; let it go now
      // rather than holding hundreds of megabytes until the request ends.
      this.overflowed = true;
      this.recorded = [];
      return;
    }
    // Keep a private copy: a producer may reuse its buffer for the next chunk.
    this.recorded.push(chunk.slice());
  }

  /**
   * Read the source to its end, recording every chunk: the rest of the
   * recording, after the live request was refused. Called once the live
   * upload has stopped reading.
   * @param signal - Aborts the drain; the source is released and the copy
   * dropped.
   * @returns A promise that resolves once the source has ended.
   * @throws DictationError (413, `audio_too_large`) when the copy passes
   * `maxBufferedAudioBytes`.
   * @throws Whatever the source throws, unchanged, or the signal's reason.
   */
  async drain(signal?: AbortSignal): Promise<void> {
    const aborted = signal ? abortion(signal) : undefined;
    try {
      for (;;) {
        if (signal?.aborted) {
          throw signal.reason ?? new Error("The operation was aborted.");
        }
        if (this.overflowed) throw overflowError();
        const next = this.next();
        const result = aborted
          ? await Promise.race([next, aborted.promise])
          : await next;
        if (result.done) break;
      }
      // An abort can end the source (a session's abort() ends its queue)
      // in the same breath as it fires the signal; it is still an abort.
      if (signal?.aborted) {
        throw signal.reason ?? new Error("The operation was aborted.");
      }
      if (this.overflowed) throw overflowError();
    } catch (error) {
      this.release();
      throw error;
    } finally {
      aborted?.dispose();
    }
  }

  /**
   * Hand over the recorded audio, in order, and forget it here.
   * @returns The recorded chunks.
   * @throws DictationError (413, `audio_too_large`) when the copy passed
   * `maxBufferedAudioBytes`.
   */
  take(): Uint8Array[] {
    if (this.overflowed) throw overflowError();
    const recorded = this.recorded;
    this.recorded = [];
    return recorded;
  }

  /**
   * Let go of the source and drop the copy. A source still producing is
   * stopped, as the live upload would have stopped it.
   */
  release(): void {
    this.released = true;
    this.recorded = [];
    void this.iterator.return?.()?.catch(() => undefined);
  }
}
