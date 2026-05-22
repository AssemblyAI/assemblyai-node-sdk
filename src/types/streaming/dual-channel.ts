/**
 * Physical input channel that a word/turn was attributed to.
 * - A channel name declared in `StreamingTranscriberParams.channels` (e.g. `"mic"`, `"system"`).
 * - `"unknown"`: no channel was clearly dominant during the word's time window (silent
 *   or all channels evenly active under our threshold).
 *
 * This is independent of AssemblyAI's diarization `speaker_label` / `words[i].speaker`,
 * which identifies voices by acoustic characteristics. A given speaker_label can map
 * to any physical channel; the two dimensions can disagree.
 */
export type Channel = string | "unknown";

/**
 * Per-channel, per-frame VAD observation emitted by `StreamingTranscriber` when running
 * in dual-channel mode. `ts` is stream-relative milliseconds, derived from the
 * per-channel sample counter — the same reference frame as `StreamingWord.start` /
 * `.end`, so per-word lookups need no conversion.
 */
export type VadFrame = {
  ts: number;
  channel: string;
  active: boolean;
  rms: number;
};

export type VadDetectorResult = {
  active: boolean;
  energy: number;
};

/**
 * Pluggable per-channel voice-activity detector. The default `EnergyVad` is energy-based
 * with an adaptive noise-floor threshold; callers can drop in a DNN-backed detector
 * (e.g. Silero via `@ricky0123/vad-web`) for noisier environments.
 *
 * A separate `VadDetector` instance is held per channel; do not assume cross-channel
 * state. Frames are fixed-size at the transcriber's target sample rate.
 */
export interface VadDetector {
  process(frame: Float32Array): VadDetectorResult;
  reset(): void;
}

/**
 * Thrown when `DualChannelCapture` is constructed in a non-browser environment
 * (no `globalThis.AudioContext`). The helper is intentionally surfaced from the
 * main entrypoint so the import path is uniform across runtimes; the runtime
 * guard moves to construction time.
 */
export class BrowserOnlyError extends Error {
  constructor(
    message = "DualChannelCapture requires a browser environment (AudioContext is undefined).",
  ) {
    super(message);
    this.name = "BrowserOnlyError";
  }
}
