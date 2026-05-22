import {
  float32ToPcm16,
  LinearResampler,
} from "../../src/services/streaming/resampler";

describe("LinearResampler", () => {
  it("is identity when source == target", () => {
    const r = new LinearResampler(16000, 16000);
    const input = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const out = r.process(input);
    expect(out.length).toBe(4);
    for (let i = 0; i < 4; i++) expect(out[i]).toBeCloseTo(input[i], 5);
  });

  it("approximately halves length when down-sampling 2:1", () => {
    const r = new LinearResampler(48000, 24000);
    const input = new Float32Array(960);
    for (let i = 0; i < input.length; i++) input[i] = i / 960;
    const out = r.process(input);
    expect(out.length).toBeGreaterThan(479);
    expect(out.length).toBeLessThan(482);
  });

  it("preserves continuity across chunk boundaries", () => {
    const r = new LinearResampler(48000, 16000);
    const chunkA = new Float32Array(480);
    const chunkB = new Float32Array(480);
    for (let i = 0; i < 480; i++) {
      chunkA[i] = i;
      chunkB[i] = 480 + i;
    }
    const a = r.process(chunkA);
    const b = r.process(chunkB);
    expect(b.length).toBeGreaterThan(0);
    // The first output of chunkB should be near the last input of chunkA
    // (continuity), not jump back to 0.
    expect(b[0]).toBeGreaterThan(a[a.length - 1]);
  });

  it("rejects non-positive sample rates", () => {
    expect(() => new LinearResampler(0, 16000)).toThrow();
    expect(() => new LinearResampler(48000, -1)).toThrow();
  });
});

describe("float32ToPcm16", () => {
  it("clamps and packs to little-endian Int16", () => {
    const buf = float32ToPcm16(new Float32Array([0, 1, -1, 2, -2]));
    const view = new DataView(buf);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(0x7fff);
    expect(view.getInt16(4, true)).toBe(-0x8000);
    expect(view.getInt16(6, true)).toBe(0x7fff); // clamped from 2
    expect(view.getInt16(8, true)).toBe(-0x8000); // clamped from -2
  });

  it("returns an empty buffer for empty input", () => {
    const buf = float32ToPcm16(new Float32Array(0));
    expect(buf.byteLength).toBe(0);
  });
});
