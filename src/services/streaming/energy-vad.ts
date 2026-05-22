import {
  VadDetector,
  VadDetectorResult,
} from "../../types/streaming/dual-channel";

export type EnergyVadParams = {
  /** Threshold = noiseFloor * thresholdRatio. Default 3.0 (~ +9.5 dB above noise). */
  thresholdRatio?: number;
  /** EMA smoothing for the noise-floor estimate when frame is non-speech. Default 0.05. */
  noiseFloorAlpha?: number;
  /** Hangover in frames: stay "active" this many frames after the last speech frame. Default 10 (\~200 ms at 20 ms frames). */
  hangoverFrames?: number;
  /** Initial noise floor estimate. Default 1e-4. Adaptive after the first non-speech frame. */
  initialNoiseFloor?: number;
};

/**
 * Energy-based VAD with adaptive noise-floor tracking and hangover. Pure JS,
 * no dependencies. Suitable for the "which physical channel is speaking" task
 * because the channels are already physically separated at capture — the harder
 * problem (speech vs. non-speech in the wild) is one a customer can swap in a
 * DNN VAD for via the `createVad` parameter.
 *
 * Tuning notes:
 * - thresholdRatio below 2 will treat anything above noise as speech (too sensitive).
 * - thresholdRatio above 6 will miss quiet utterance onsets/offsets.
 * - noiseFloorAlpha above 0.1 makes the floor track quickly (good for non-stationary
 *   background) but risks slowly adapting *up* to a sustained low voice.
 */
export class EnergyVad implements VadDetector {
  private readonly thresholdRatio: number;
  private readonly noiseFloorAlpha: number;
  private readonly hangoverFrames: number;
  private readonly initialNoiseFloor: number;
  private noiseFloor: number;
  private hangoverRemaining = 0;

  constructor(params: EnergyVadParams = {}) {
    this.thresholdRatio = params.thresholdRatio ?? 3.0;
    this.noiseFloorAlpha = params.noiseFloorAlpha ?? 0.05;
    this.hangoverFrames = params.hangoverFrames ?? 10;
    this.initialNoiseFloor = params.initialNoiseFloor ?? 1e-4;
    this.noiseFloor = this.initialNoiseFloor;
  }

  process(frame: Float32Array): VadDetectorResult {
    let sumSq = 0;
    for (let i = 0; i < frame.length; i++) {
      sumSq += frame[i] * frame[i];
    }
    const rms = frame.length > 0 ? Math.sqrt(sumSq / frame.length) : 0;

    const threshold = this.noiseFloor * this.thresholdRatio;
    let active = rms > threshold;

    if (active) {
      this.hangoverRemaining = this.hangoverFrames;
    } else if (this.hangoverRemaining > 0) {
      this.hangoverRemaining--;
      active = true;
      // While in hangover, do not update noise floor — RMS may still reflect tail energy.
    } else {
      this.noiseFloor =
        this.noiseFloor * (1 - this.noiseFloorAlpha) +
        rms * this.noiseFloorAlpha;
    }

    return { active, energy: rms };
  }

  reset(): void {
    this.noiseFloor = this.initialNoiseFloor;
    this.hangoverRemaining = 0;
  }
}
