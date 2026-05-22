/**
 * AudioWorklet processor that ingests mono Float32 audio at the AudioContext's
 * native sample rate, resamples to `targetRate` (linear interpolation, stateful
 * across `process()` calls), packs to little-endian Int16 PCM, and posts
 * fixed-size chunks via `port.postMessage` with a running `samplesSent` counter.
 *
 * `samplesSent` is in **target-rate samples**, so the main thread can derive a
 * stream-relative timestamp = `samplesSent / targetRate * 1000` (ms) — the same
 * frame AAI uses for `StreamingWord.start` / `.end`.
 *
 * Defined as a string so it can be registered via a Blob URL — the SDK ships as
 * a single ESM file, so a separate `.js` worklet asset isn't viable.
 */
export const pcm16EncoderWorkletSource = `
class Pcm16EncoderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.targetRate = opts.targetRate || 16000;
    this.chunkMs = opts.chunkMs || 50;
    this.ratio = sampleRate / this.targetRate;
    this.chunkSize = Math.round(this.targetRate * this.chunkMs / 1000);
    this.buffer = new Int16Array(this.chunkSize);
    this.bufferIdx = 0;
    this.samplesSent = 0;
    this.lastSample = 0;
    this.fractional = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0] || input[0].length === 0) {
      return true;
    }
    const mono = input[0];
    let pos = this.fractional;
    while (pos < mono.length) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const a = i === 0 ? this.lastSample : mono[i - 1];
      const b = mono[i];
      const sample = a + (b - a) * frac;
      const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
      this.buffer[this.bufferIdx++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      if (this.bufferIdx === this.chunkSize) {
        const out = new Int16Array(this.chunkSize);
        out.set(this.buffer);
        this.samplesSent += this.chunkSize;
        this.port.postMessage(
          { pcm: out.buffer, samplesSent: this.samplesSent },
          [out.buffer],
        );
        this.bufferIdx = 0;
      }
      pos += this.ratio;
    }
    this.lastSample = mono[mono.length - 1];
    this.fractional = pos - mono.length;
    return true;
  }
}
registerProcessor("aai-pcm16-encoder", Pcm16EncoderProcessor);
`;

export const PCM16_ENCODER_PROCESSOR_NAME = "aai-pcm16-encoder";

export type Pcm16EncoderMessage = {
  pcm: ArrayBuffer;
  samplesSent: number;
};
