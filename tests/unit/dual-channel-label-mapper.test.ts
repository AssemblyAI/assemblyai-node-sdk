import { StreamingWord, TurnEvent } from "../../src";
import {
  attributeTurn,
  attributeWord,
  rollUpTurnChannel,
  VadTimeline,
} from "../../src/services/streaming/label-mapper";
import { VadFrame } from "../../src/types/streaming/dual-channel";

function frame(
  ts: number,
  channel: string,
  active: boolean,
  rms = active ? 0.5 : 0,
): VadFrame {
  return { ts, channel, active, rms };
}

function buildTimeline(frames: VadFrame[]): VadTimeline {
  const t = new VadTimeline(60_000);
  for (const f of frames) t.pushFrame(f);
  return t;
}

describe("attributeWord", () => {
  const params = { dominanceRatio: 4 };

  it("returns 'unknown' for a window with no VAD frames", () => {
    const t = new VadTimeline(60_000);
    const ch = attributeWord(
      { start: 0, end: 200, confidence: 1, text: "hi", word_is_final: true },
      t,
      params,
    );
    expect(ch).toBe("unknown");
  });

  it("returns 'mic' when only mic frames are active in the window", () => {
    const t = buildTimeline([
      frame(10, "mic", true),
      frame(30, "mic", true),
      frame(50, "mic", true),
    ]);
    const ch = attributeWord(
      { start: 0, end: 100, confidence: 1, text: "hello", word_is_final: true },
      t,
      params,
    );
    expect(ch).toBe("mic");
  });

  it("returns 'system' when only system frames are active", () => {
    const t = buildTimeline([
      frame(10, "system", true),
      frame(30, "system", true),
    ]);
    const ch = attributeWord(
      { start: 0, end: 100, confidence: 1, text: "ok", word_is_final: true },
      t,
      params,
    );
    expect(ch).toBe("system");
  });

  it("returns the higher-scoring channel when ratio threshold not met", () => {
    const t = buildTimeline([
      frame(10, "mic", true, 0.5),
      frame(20, "system", true, 0.4),
    ]);
    const ch = attributeWord(
      { start: 0, end: 100, confidence: 1, text: "x", word_is_final: true },
      t,
      params,
    );
    expect(ch).toBe("mic");
  });

  it("returns 'unknown' on an exact tie", () => {
    const t = buildTimeline([
      frame(10, "mic", true, 0.5),
      frame(20, "system", true, 0.5),
    ]);
    const ch = attributeWord(
      { start: 0, end: 100, confidence: 1, text: "x", word_is_final: true },
      t,
      params,
    );
    expect(ch).toBe("unknown");
  });

  it("ignores inactive frames", () => {
    const t = buildTimeline([
      frame(10, "mic", false, 0.9),
      frame(20, "system", true, 0.1),
    ]);
    const ch = attributeWord(
      { start: 0, end: 100, confidence: 1, text: "x", word_is_final: true },
      t,
      params,
    );
    expect(ch).toBe("system");
  });

  it("ignores frames outside the [start, end] window", () => {
    const t = buildTimeline([
      frame(10, "system", true),
      frame(150, "mic", true),
      frame(500, "system", true),
    ]);
    const ch = attributeWord(
      { start: 100, end: 200, confidence: 1, text: "x", word_is_final: true },
      t,
      params,
    );
    expect(ch).toBe("mic");
  });
});

describe("rollUpTurnChannel", () => {
  function w(
    channel: string | undefined,
    start: number,
    end: number,
  ): StreamingWord {
    return {
      start,
      end,
      confidence: 1,
      text: "x",
      word_is_final: true,
      channel,
    };
  }

  it("returns 'unknown' for an empty word list", () => {
    expect(rollUpTurnChannel([])).toBe("unknown");
  });

  it("returns 'unknown' when all words are unknown", () => {
    expect(rollUpTurnChannel([w("unknown", 0, 100)])).toBe("unknown");
  });

  it("returns 'unknown' when all words are missing a channel", () => {
    expect(rollUpTurnChannel([w(undefined, 0, 100)])).toBe("unknown");
  });

  it("returns the duration-dominant channel", () => {
    expect(
      rollUpTurnChannel([w("mic", 0, 1000), w("system", 1000, 1100)]),
    ).toBe("mic");
  });

  it("returns 'unknown' on equal mic/system durations", () => {
    expect(rollUpTurnChannel([w("mic", 0, 500), w("system", 500, 1000)])).toBe(
      "unknown",
    );
  });

  it("ignores unknown-channel words in the rollup vote", () => {
    expect(
      rollUpTurnChannel([w("unknown", 0, 10_000), w("mic", 10_000, 10_200)]),
    ).toBe("mic");
  });
});

describe("attributeTurn", () => {
  it("mutates the turn in place: sets channel on each word and rolls up", () => {
    const t = buildTimeline([
      frame(10, "mic", true),
      frame(150, "system", true),
    ]);
    const turn: TurnEvent = {
      type: "Turn",
      turn_order: 1,
      turn_is_formatted: false,
      end_of_turn: true,
      transcript: "hi there",
      end_of_turn_confidence: 0.9,
      speaker_label: "A",
      words: [
        {
          start: 0,
          end: 100,
          confidence: 1,
          text: "hi",
          word_is_final: true,
          speaker: "A",
        },
        {
          start: 100,
          end: 200,
          confidence: 1,
          text: "there",
          word_is_final: true,
          speaker: "A",
        },
      ],
    };
    attributeTurn(turn, t, { dominanceRatio: 4 });
    expect(turn.speaker_label).toBe("A");
    expect(turn.words[0].speaker).toBe("A");
    expect(turn.words[0].channel).toBe("mic");
    expect(turn.words[1].channel).toBe("system");
    expect(turn.channel).toBe("unknown"); // equal duration → tie → unknown
  });
});

describe("VadTimeline window behavior", () => {
  it("drops frames outside the rolling window", () => {
    const t = new VadTimeline(100);
    t.pushFrame(frame(0, "mic", true));
    t.pushFrame(frame(50, "mic", true));
    t.pushFrame(frame(150, "mic", true));
    t.pushFrame(frame(200, "system", true));
    const inWindow = t.framesInWindow(0, 1000);
    expect(inWindow.map((f) => f.ts)).toEqual([150, 200]);
  });

  it("keeps everything inside the rolling window", () => {
    const t = new VadTimeline(1000);
    t.pushFrame(frame(0, "mic", true));
    t.pushFrame(frame(500, "mic", true));
    t.pushFrame(frame(900, "mic", true));
    const inWindow = t.framesInWindow(0, 1000);
    expect(inWindow.length).toBe(3);
  });
});
