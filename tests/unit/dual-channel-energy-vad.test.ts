import { EnergyVad } from "../../src/services/streaming/energy-vad";

const FRAME = 320;

function silence(): Float32Array {
  return new Float32Array(FRAME);
}

function tone(amp: number): Float32Array {
  const f = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) f[i] = amp * Math.sin((2 * Math.PI * i) / 16);
  return f;
}

describe("EnergyVad", () => {
  it("reports silent frames as inactive after the noise floor adapts", () => {
    const vad = new EnergyVad({ initialNoiseFloor: 1e-4, hangoverFrames: 0 });
    // Warm up noise floor with silence.
    for (let i = 0; i < 5; i++) vad.process(silence());
    expect(vad.process(silence()).active).toBe(false);
  });

  it("triggers on a tone significantly above the noise floor", () => {
    const vad = new EnergyVad({ initialNoiseFloor: 1e-4, hangoverFrames: 0 });
    for (let i = 0; i < 5; i++) vad.process(silence());
    expect(vad.process(tone(0.5)).active).toBe(true);
  });

  it("holds active state through hangover frames", () => {
    const vad = new EnergyVad({ initialNoiseFloor: 1e-4, hangoverFrames: 3 });
    for (let i = 0; i < 5; i++) vad.process(silence());
    expect(vad.process(tone(0.5)).active).toBe(true);
    expect(vad.process(silence()).active).toBe(true);
    expect(vad.process(silence()).active).toBe(true);
    expect(vad.process(silence()).active).toBe(true);
    expect(vad.process(silence()).active).toBe(false);
  });

  it("reset() restores initial state", () => {
    const vad = new EnergyVad({ initialNoiseFloor: 1e-4, hangoverFrames: 5 });
    vad.process(tone(0.9));
    expect(vad.process(silence()).active).toBe(true); // in hangover
    vad.reset();
    expect(vad.process(silence()).active).toBe(false);
  });

  it("returns RMS energy alongside the activity decision", () => {
    const vad = new EnergyVad();
    const result = vad.process(tone(0.5));
    expect(result.energy).toBeGreaterThan(0);
    expect(result.energy).toBeLessThan(1);
  });
});
