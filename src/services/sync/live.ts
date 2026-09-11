import { SyncTranscriptResponse } from "../..";
import {
  LiveSession,
  describe,
  isIterable,
  isWebReadableStream,
} from "../../utils/live";

/**
 * The sync API's live upload: which inputs its live route takes, and the
 * push-style session `client.sync.openLive()` returns. The multipart framing
 * and the session machinery they are built on are shared across the products
 * that upload audio as it is produced.
 */

/**
 * Whether `input` is something the live route can drain: an async iterable
 * (Node streams included), a sync iterable of chunks, or a web
 * `ReadableStream`. Bytes, Blobs and paths are rejected by name: audio the
 * caller already holds whole belongs in `transcribe()`.
 * @param input - The audio the caller passed to `transcribeLive()`.
 * @throws TypeError when the input is not a stream or iterable of chunks.
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
export class SyncLiveSession extends LiveSession<SyncTranscriptResponse> {}
