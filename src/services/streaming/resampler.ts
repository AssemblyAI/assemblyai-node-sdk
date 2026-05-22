/**
 * Linear-interpolation resampler for streaming Float32 audio. Stateful across
 * `process()` calls so chunk boundaries don't introduce phase discontinuities:
 * the last input sample and a fractional read position are carried over.
 *
 * Linear interpolation is good enough for ASR ingest — the downstream
 * StreamingTranscriber band-limits at the target rate anyway, and a polyphase
 * filter would be overkill in the AudioWorklet hot path. If a customer needs
 * higher quality they can supply their own VadDetector + bypass the encoder.
 */
export class LinearResampler {
  private readonly ratio: number;
  private lastSample = 0;
  private fractional = 0;

  constructor(
    private readonly sourceRate: number,
    private readonly targetRate: number,
  ) {
    if (sourceRate <= 0 || targetRate <= 0) {
      throw new Error("sourceRate and targetRate must be positive");
    }
    this.ratio = sourceRate / targetRate;
  }

  process(input: Float32Array): Float32Array {
    if (this.sourceRate === this.targetRate) {
      return input;
    }

    // Worst-case output length; we'll slice to actual.
    const out = new Float32Array(Math.ceil(input.length / this.ratio) + 1);
    let outIdx = 0;
    let pos = this.fractional;

    while (pos < input.length) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const a = i === 0 ? this.lastSample : input[i - 1];
      const b = input[i];
      out[outIdx++] = a + (b - a) * frac;
      pos += this.ratio;
    }

    this.lastSample = input[input.length - 1] ?? this.lastSample;
    this.fractional = pos - input.length;
    return out.subarray(0, outIdx);
  }

  reset(): void {
    this.lastSample = 0;
    this.fractional = 0;
  }
}

/** Convert Float32 PCM (-1..1) to little-endian Int16 PCM. */
export function float32ToPcm16(input: Float32Array): ArrayBuffer {
  const out = new ArrayBuffer(input.length * 2);
  const view = new DataView(out);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(
      i * 2,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
  }
  return out;
}
