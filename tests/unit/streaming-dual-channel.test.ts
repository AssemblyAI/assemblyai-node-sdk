jest.mock("ws", () => require("./mocks/ws"));

import WS from "jest-websocket-mock";
import fetchMock from "jest-fetch-mock";
import { StreamingTranscriber, TurnEvent, VadFrame } from "../../src";

fetchMock.enableMocks();

const websocketBaseUrl = "wss://localhost:4242/v3/ws";

const sessionBeginsMessage = {
  type: "Begin",
  id: "abc",
  expires_at: 1,
};

const sessionTerminatedMessage = {
  type: "Termination",
};

async function connect(rt: StreamingTranscriber, server: WS): Promise<void> {
  const p = rt.connect();
  await server.connected;
  server.send(JSON.stringify(sessionBeginsMessage));
  await p;
}

async function teardown(rt: StreamingTranscriber, server: WS): Promise<void> {
  const p = rt.close();
  server.send(JSON.stringify(sessionTerminatedMessage));
  await p;
  await server.closed;
  WS.clean();
}

/** Build a 20ms-frame-aligned loud Int16 PCM buffer at the given amplitude. */
function loudPcm(samples: number, amplitude = 20_000): ArrayBuffer {
  const buf = new Int16Array(samples);
  for (let i = 0; i < samples; i++) {
    buf[i] = i % 2 === 0 ? amplitude : -amplitude;
  }
  return buf.buffer;
}

/** Build a silent Int16 PCM buffer (all zeros). */
function silentPcm(samples: number): ArrayBuffer {
  return new Int16Array(samples).buffer;
}

describe("StreamingTranscriber constructor validation (dual-channel)", () => {
  it("throws when channels has the wrong arity", () => {
    expect(
      () =>
        new StreamingTranscriber({
          token: "t",
          sampleRate: 16_000,
          speechModel: "u3-rt-pro",
          channels: [{ name: "only" }],
        }),
    ).toThrow(/exactly 2/);
  });

  it("throws when channel names are not unique", () => {
    expect(
      () =>
        new StreamingTranscriber({
          token: "t",
          sampleRate: 16_000,
          speechModel: "u3-rt-pro",
          channels: [{ name: "dup" }, { name: "dup" }],
        }),
    ).toThrow(/unique/);
  });
});

describe("StreamingTranscriber single-channel backward compat", () => {
  let server: WS;
  let rt: StreamingTranscriber;

  beforeEach(async () => {
    server = new WS(websocketBaseUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "t",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
    });
    await connect(rt, server);
  });

  afterEach(async () => {
    await teardown(rt, server);
  });

  it("sendAudio(buf) forwards directly to ws (no channel needed)", async () => {
    const payload = silentPcm(160);
    rt.sendAudio(payload);
    await expect(server).toReceiveMessage(payload);
  });

  it("sendAudio(buf, { channel }) is accepted and ignored in single-channel mode", async () => {
    const payload = silentPcm(160);
    rt.sendAudio(payload, { channel: "anything" });
    await expect(server).toReceiveMessage(payload);
  });
});

describe("StreamingTranscriber dual-channel sendAudio validation", () => {
  let server: WS;
  let rt: StreamingTranscriber;

  beforeEach(async () => {
    server = new WS(websocketBaseUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "t",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      channels: [{ name: "mic" }, { name: "system" }],
    });
    await connect(rt, server);
  });

  afterEach(async () => {
    await teardown(rt, server);
  });

  it("throws when channel is missing in dual-channel mode", () => {
    expect(() => rt.sendAudio(silentPcm(16))).toThrow(
      /dual-channel mode; sendAudio requires/,
    );
  });

  it("throws on unknown channel name", () => {
    expect(() => rt.sendAudio(silentPcm(16), { channel: "bogus" })).toThrow(
      /Unknown channel "bogus"/,
    );
  });
});

describe("StreamingTranscriber dual-channel mixing and VAD", () => {
  let server: WS;
  let rt: StreamingTranscriber;

  beforeEach(async () => {
    server = new WS(websocketBaseUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "t",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      channels: [{ name: "mic" }, { name: "system" }],
      channelAttribution: { flushIntervalMs: 50 },
    });
    await connect(rt, server);
  });

  afterEach(async () => {
    await teardown(rt, server);
  });

  it("flushes mixed mono PCM at flushIntervalMs cadence", async () => {
    // 800 samples = 50ms at 16kHz on each channel — exactly the minimum the
    // server accepts per audio message. Both channels send the same amount,
    // so the next flush emits 800 Int16 samples = 1600 bytes of mono PCM.
    rt.sendAudio(loudPcm(800), { channel: "mic" });
    rt.sendAudio(silentPcm(800), { channel: "system" });
    const msg = (await server.nextMessage) as ArrayBuffer;
    expect(msg.byteLength).toBe(800 * 2);
  });

  it("emits a 'vad' event per 20ms frame as PCM is ingested", () => {
    const vadFrames: VadFrame[] = [];
    rt.on("vad", (f) => vadFrames.push(f));
    // 320 samples = exactly one 20ms VAD frame at 16kHz.
    rt.sendAudio(loudPcm(320), { channel: "mic" });
    rt.sendAudio(silentPcm(320), { channel: "system" });
    expect(vadFrames.length).toBe(2);
    const channels = vadFrames.map((f) => f.channel).sort();
    expect(channels).toEqual(["mic", "system"]);
    const mic = vadFrames.find((f) => f.channel === "mic")!;
    expect(mic.rms).toBeGreaterThan(0);
    expect(mic.ts).toBeCloseTo(20, 1); // 320 / 16000 * 1000 = 20ms
  });

  it("attributes a Turn message based on per-channel VAD energy", async () => {
    const received: TurnEvent[] = [];
    rt.on("turn", (t) => received.push(t));

    // Drive ~200ms of loud mic audio + matching silence on system.
    // Energy VAD with default thresholdRatio=3 takes a few frames to "lock on";
    // 10 frames (200ms) is enough to push energy well above the adaptive floor.
    for (let i = 0; i < 10; i++) {
      rt.sendAudio(loudPcm(320), { channel: "mic" });
      rt.sendAudio(silentPcm(320), { channel: "system" });
    }

    const turn: TurnEvent = {
      type: "Turn",
      turn_order: 1,
      turn_is_formatted: false,
      end_of_turn: true,
      transcript: "hello",
      end_of_turn_confidence: 0.9,
      speaker_label: "A",
      words: [
        {
          start: 20,
          end: 200,
          confidence: 1,
          text: "hello",
          word_is_final: true,
          speaker: "A",
        },
      ],
    };
    server.send(JSON.stringify(turn));

    expect(received).toHaveLength(1);
    const got = received[0];
    expect(got.speaker_label).toBe("A");
    expect(got.words[0].speaker).toBe("A");
    expect(got.words[0].channel).toBe("mic");
    expect(got.channel).toBe("mic");
  });

  it("mixes per-channel PCM with /channelCount averaging", async () => {
    // 800 samples each (50ms floor): mic constant +10000, system constant
    // -10000. Average per sample = 0; mixed mono should be all zeros.
    const micBuf = new Int16Array(800);
    const sysBuf = new Int16Array(800);
    for (let i = 0; i < 800; i++) {
      micBuf[i] = 10_000;
      sysBuf[i] = -10_000;
    }
    rt.sendAudio(micBuf.buffer, { channel: "mic" });
    rt.sendAudio(sysBuf.buffer, { channel: "system" });
    const msg = (await server.nextMessage) as ArrayBuffer;
    const mixed = new Int16Array(msg);
    expect(mixed.length).toBe(800);
    for (let i = 0; i < mixed.length; i++) {
      expect(mixed[i]).toBe(0);
    }

    // Now: both channels at +20000 → mix should be +20000 (avg, not sum).
    const both = new Int16Array(800);
    for (let i = 0; i < 800; i++) both[i] = 20_000;
    rt.sendAudio(both.buffer, { channel: "mic" });
    rt.sendAudio(both.buffer, { channel: "system" });
    const msg2 = (await server.nextMessage) as ArrayBuffer;
    const mixed2 = new Int16Array(msg2);
    for (let i = 0; i < mixed2.length; i++) {
      expect(mixed2[i]).toBe(20_000);
    }
  });

  it("only flushes min(channel lengths); the longer channel retains its tail", async () => {
    // Mic: 1600 samples, system: 800 samples (both ≥ the 50ms floor). First
    // flush should emit 800 mixed samples; the remaining 800 mic samples wait
    // for system to catch up.
    rt.sendAudio(loudPcm(1600), { channel: "mic" });
    rt.sendAudio(silentPcm(800), { channel: "system" });
    const first = (await server.nextMessage) as ArrayBuffer;
    expect(first.byteLength).toBe(800 * 2);

    // Now feed 800 more on system → second flush of 800 mixed samples.
    rt.sendAudio(silentPcm(800), { channel: "system" });
    const second = (await server.nextMessage) as ArrayBuffer;
    expect(second.byteLength).toBe(800 * 2);
  });

  it("aggregates samples across sendAudio calls into a single VAD frame", () => {
    const vadFrames: VadFrame[] = [];
    rt.on("vad", (f) => vadFrames.push(f));
    // Feed mic in two halves of 160 samples — should still produce exactly one
    // 20ms VAD frame once the second half lands.
    rt.sendAudio(loudPcm(160), { channel: "mic" });
    expect(vadFrames.filter((f) => f.channel === "mic")).toHaveLength(0);
    rt.sendAudio(loudPcm(160), { channel: "mic" });
    const mic = vadFrames.filter((f) => f.channel === "mic");
    expect(mic).toHaveLength(1);
    expect(mic[0].ts).toBeCloseTo(20, 1); // 320 / 16000 * 1000
  });

  it("withholds sub-50ms flushes until enough audio accumulates", async () => {
    // 320 samples = 20ms — below the server's 50ms floor. The mixer should
    // hold them in the per-channel buffers and NOT emit a message yet.
    rt.sendAudio(loudPcm(320), { channel: "mic" });
    rt.sendAudio(silentPcm(320), { channel: "system" });
    // Top each channel up to exactly 50ms (320 + 480 = 800 samples). Now the
    // floor is met and the next flush emits 800 samples — and only those 800.
    rt.sendAudio(loudPcm(480), { channel: "mic" });
    rt.sendAudio(silentPcm(480), { channel: "system" });

    const msg = (await server.nextMessage) as ArrayBuffer;
    expect(msg.byteLength).toBe(800 * 2);
  });

  it("produces multiple sequential flushes as new PCM arrives", async () => {
    rt.sendAudio(loudPcm(800), { channel: "mic" });
    rt.sendAudio(silentPcm(800), { channel: "system" });
    const a = (await server.nextMessage) as ArrayBuffer;
    expect(a.byteLength).toBe(800 * 2);

    rt.sendAudio(loudPcm(800), { channel: "mic" });
    rt.sendAudio(silentPcm(800), { channel: "system" });
    const b = (await server.nextMessage) as ArrayBuffer;
    expect(b.byteLength).toBe(800 * 2);
  });

  it("caps each emitted chunk at MAX_CHUNK_MS even with a large backlog", async () => {
    // 8000 samples per channel = 500 ms backlog at 16 kHz. Without the cap
    // this would emit a single 16,000-byte (>1000 ms equivalent on the wire)
    // message; with the cap it drains in multiple ≤200 ms (3200-sample) sends.
    rt.sendAudio(loudPcm(8000), { channel: "mic" });
    rt.sendAudio(silentPcm(8000), { channel: "system" });

    let totalSamples = 0;
    const maxSamplesPerSend = Math.round(16_000 * (200 / 1000));
    while (totalSamples < 8000) {
      const msg = (await server.nextMessage) as ArrayBuffer;
      const samples = msg.byteLength / 2;
      expect(samples).toBeLessThanOrEqual(maxSamplesPerSend);
      expect(samples).toBeGreaterThan(0);
      totalSamples += samples;
    }
    expect(totalSamples).toBe(8000);
  });

  it("clears the flush timer when the socket is closed externally", async () => {
    const spy = jest.spyOn(global, "clearInterval");
    rt.sendAudio(silentPcm(160), { channel: "mic" });
    rt.sendAudio(silentPcm(160), { channel: "system" });
    // Close the client-side WebSocket without going through transcriber.close().
    // The onclose handler should fire and clear the flush timer so subsequent
    // ticks don't try to call send() on a dead socket.
    type SocketHolder = { socket?: { close: () => void } };
    (rt as unknown as SocketHolder).socket?.close();
    // Yield a tick so the onclose event drains.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();

    // Replace rt/server so afterEach can run the standard teardown.
    WS.clean();
    server = new WS(websocketBaseUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "t",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      channels: [{ name: "mic" }, { name: "system" }],
      channelAttribution: { flushIntervalMs: 50 },
    });
    await connect(rt, server);
  });

  it("close() clears the flush timer", async () => {
    const spy = jest.spyOn(global, "clearInterval");
    rt.sendAudio(silentPcm(160), { channel: "mic" });
    rt.sendAudio(silentPcm(160), { channel: "system" });

    const closePromise = rt.close();
    server.send(JSON.stringify(sessionTerminatedMessage));
    await closePromise;
    await server.closed;
    WS.clean();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();

    // Replace rt/server so afterEach can run the standard teardown without errors.
    server = new WS(websocketBaseUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "t",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
    });
    await connect(rt, server);
  });
});

describe("StreamingTranscriber resolveUnknownChannelsMethod = 'window'", () => {
  let server: WS;
  let rt: StreamingTranscriber;

  beforeEach(async () => {
    server = new WS(websocketBaseUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "t",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      channels: [{ name: "mic" }, { name: "system" }],
      channelAttribution: {
        resolveUnknownChannelsMethod: "window",
        resolutionWindowWords: 2,
      },
    });
    await connect(rt, server);
  });

  afterEach(async () => {
    await teardown(rt, server);
  });

  /**
   * Build a TurnEvent whose words already have pre-set `channel` values, so
   * tests can exercise the unknown-channel resolver without driving VAD audio
   * through the transcriber. attributeTurn() will overwrite the channels with
   * what it sees on the timeline — but for words whose timestamps don't
   * overlap any timeline frame, attributeTurn returns "unknown", preserving
   * the pre-set values via... actually no, it sets unknown.
   *
   * To get reliable per-word channel values we drive the timeline first.
   */
  function makeTurn(
    words: Array<{
      text: string;
      start: number;
      end: number;
      speaker?: string;
    }>,
  ): TurnEvent {
    return {
      type: "Turn",
      turn_order: 1,
      turn_is_formatted: false,
      end_of_turn: true,
      transcript: words.map((w) => w.text).join(" "),
      end_of_turn_confidence: 0.9,
      speaker_label: words[0].speaker ?? "A",
      words: words.map((w) => ({
        start: w.start,
        end: w.end,
        confidence: 1,
        text: w.text,
        word_is_final: true,
        speaker: w.speaker ?? "A",
      })),
    };
  }

  it("fills an unknown word surrounded by mic neighbors and marks it channelResolved", async () => {
    const received: TurnEvent[] = [];
    rt.on("turn", (t) => received.push(t));

    // Drive ~200ms of mic-loud audio so the first two words get a confident
    // "mic" attribution from per-word VAD.
    for (let i = 0; i < 10; i++) {
      rt.sendAudio(loudPcm(320), { channel: "mic" });
      rt.sendAudio(silentPcm(320), { channel: "system" });
    }

    // Word at [10000, 10100] has no VAD frames → unknown. Surrounding mic
    // words should let the window resolver fill it as mic.
    server.send(
      JSON.stringify(
        makeTurn([
          { text: "hello", start: 20, end: 80 },
          { text: "there", start: 100, end: 180 },
          { text: "a", start: 10_000, end: 10_100 }, // no VAD evidence
        ]),
      ),
    );

    const turn = received[0];
    expect(turn.words[0].channel).toBe("mic");
    expect(turn.words[1].channel).toBe("mic");
    expect(turn.words[2].channel).toBe("mic");
    expect(turn.words[2].channelResolved).toBe(true);
    expect(turn.words[0].channelResolved).toBeUndefined();
    expect(turn.channel).toBe("mic");
  });

  it("leaves an unknown word alone if it has no non-unknown neighbors", async () => {
    const received: TurnEvent[] = [];
    rt.on("turn", (t) => received.push(t));

    // No audio driven → all words attributeWord-resolve to "unknown".
    server.send(
      JSON.stringify(
        makeTurn([
          { text: "x", start: 0, end: 100 },
          { text: "y", start: 100, end: 200 },
          { text: "z", start: 200, end: 300 },
        ]),
      ),
    );

    const turn = received[0];
    for (const w of turn.words) {
      expect(w.channel).toBe("unknown");
      expect(w.channelResolved).toBeUndefined();
    }
  });

  it("leaves an unknown word alone on a neighbor tie (1 mic + 1 system)", async () => {
    const received: TurnEvent[] = [];
    rt.on("turn", (t) => received.push(t));

    // Drive both: 200ms loud on mic AND loud on system. First we need mic-only
    // for the first word, then system-only for the third word, separated by
    // an unknown middle. That requires two distinct time windows.
    // Window 1 (0-200ms): mic loud, system silent → first word resolves to mic.
    for (let i = 0; i < 10; i++) {
      rt.sendAudio(loudPcm(320), { channel: "mic" });
      rt.sendAudio(silentPcm(320), { channel: "system" });
    }
    // Window 2 (200-400ms): mic silent, system loud → third word resolves to system.
    for (let i = 0; i < 10; i++) {
      rt.sendAudio(silentPcm(320), { channel: "mic" });
      rt.sendAudio(loudPcm(320), { channel: "system" });
    }

    server.send(
      JSON.stringify(
        makeTurn([
          { text: "first", start: 20, end: 180 },
          { text: "middle", start: 5_000, end: 5_100 }, // unknown, no VAD
          { text: "third", start: 220, end: 380 },
        ]),
      ),
    );

    const turn = received[0];
    expect(turn.words[0].channel).toBe("mic");
    expect(turn.words[2].channel).toBe("system");
    // Tie between mic and system neighbors → middle stays unknown.
    expect(turn.words[1].channel).toBe("unknown");
    expect(turn.words[1].channelResolved).toBeUndefined();
  });

  it("never modifies confident per-word VAD decisions", async () => {
    const received: TurnEvent[] = [];
    rt.on("turn", (t) => received.push(t));

    // Drive mic-loud audio so per-word VAD confidently calls each word "mic".
    for (let i = 0; i < 10; i++) {
      rt.sendAudio(loudPcm(320), { channel: "mic" });
      rt.sendAudio(silentPcm(320), { channel: "system" });
    }

    server.send(
      JSON.stringify(
        makeTurn([
          { text: "alpha", start: 20, end: 80 },
          { text: "beta", start: 100, end: 180 },
        ]),
      ),
    );

    const turn = received[0];
    expect(turn.words[0].channel).toBe("mic");
    expect(turn.words[1].channel).toBe("mic");
    // No words were unknown → no resolution markers should be set.
    expect(turn.words[0].channelResolved).toBeUndefined();
    expect(turn.words[1].channelResolved).toBeUndefined();
  });
});

describe("StreamingTranscriber resolveUnknownChannelsMethod = 'none'", () => {
  let server: WS;
  let rt: StreamingTranscriber;

  beforeEach(async () => {
    server = new WS(websocketBaseUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "t",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      channels: [{ name: "mic" }, { name: "system" }],
      channelAttribution: { resolveUnknownChannelsMethod: "none" },
    });
    await connect(rt, server);
  });

  afterEach(async () => {
    await teardown(rt, server);
  });

  it("leaves unknown words untouched", async () => {
    const received: TurnEvent[] = [];
    rt.on("turn", (t) => received.push(t));

    // Drive 200ms of mic-loud audio so we have a baseline timeline.
    for (let i = 0; i < 10; i++) {
      rt.sendAudio(loudPcm(320), { channel: "mic" });
      rt.sendAudio(silentPcm(320), { channel: "system" });
    }

    // Send a Turn with one word inside the mic-active window (would resolve to mic
    // even without resolution since VAD attributes it) plus one outside any VAD
    // window (would only be filled by resolution).
    const turn: TurnEvent = {
      type: "Turn",
      turn_order: 1,
      turn_is_formatted: false,
      end_of_turn: true,
      transcript: "hello x",
      end_of_turn_confidence: 0.9,
      speaker_label: "A",
      words: [
        {
          start: 20,
          end: 180,
          confidence: 1,
          text: "hello",
          word_is_final: true,
          speaker: "A",
        },
        {
          start: 100_000,
          end: 100_200,
          confidence: 1,
          text: "x",
          word_is_final: true,
          speaker: "A",
        },
      ],
    };
    server.send(JSON.stringify(turn));

    const got = received[0];
    // First word: per-word VAD attributed it (mic) — unchanged.
    expect(got.words[0].channel).toBe("mic");
    // Second word: no VAD evidence in window → unknown, and "none" leaves it.
    expect(got.words[1].channel).toBe("unknown");
    expect(got.words[1].channelResolved).toBeUndefined();
  });
});

describe("StreamingTranscriber resolveUnknownChannelsMethod default", () => {
  let server: WS;
  let rt: StreamingTranscriber;

  beforeEach(async () => {
    server = new WS(websocketBaseUrl);
    // No channelAttribution at all — default should fire: resolveUnknownChannelsMethod: "window".
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "t",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      channels: [{ name: "mic" }, { name: "system" }],
    });
    await connect(rt, server);
  });

  afterEach(async () => {
    await teardown(rt, server);
  });

  it("resolves unknown words by default (no channelAttribution passed)", async () => {
    const received: TurnEvent[] = [];
    rt.on("turn", (t) => received.push(t));

    for (let i = 0; i < 10; i++) {
      rt.sendAudio(loudPcm(320), { channel: "mic" });
      rt.sendAudio(silentPcm(320), { channel: "system" });
    }

    server.send(
      JSON.stringify({
        type: "Turn",
        turn_order: 1,
        turn_is_formatted: false,
        end_of_turn: true,
        transcript: "hello a there",
        end_of_turn_confidence: 0.9,
        speaker_label: "A",
        words: [
          {
            start: 20,
            end: 80,
            confidence: 1,
            text: "hello",
            word_is_final: true,
            speaker: "A",
          },
          {
            // No timeline coverage → resolves to "unknown" via per-word VAD.
            start: 10_000,
            end: 10_100,
            confidence: 1,
            text: "a",
            word_is_final: true,
            speaker: "A",
          },
          {
            start: 100,
            end: 180,
            confidence: 1,
            text: "there",
            word_is_final: true,
            speaker: "A",
          },
        ],
      }),
    );

    const turn = received[0];
    expect(turn.words[1].channel).toBe("mic");
    expect(turn.words[1].channelResolved).toBe(true);
  });
});

describe("StreamingTranscriber resolveUnknownChannelsMethod = 'speaker-history'", () => {
  let server: WS;
  let rt: StreamingTranscriber;

  beforeEach(async () => {
    server = new WS(websocketBaseUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "t",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      channels: [{ name: "mic" }, { name: "system" }],
      channelAttribution: {
        resolveUnknownChannelsMethod: "speaker-history",
        // Low threshold so a single turn's worth of audio is enough.
        speakerHistoryMinRmsEvidence: 0.01,
        speakerHistoryDominanceRatio: 3,
      },
    });
    await connect(rt, server);
  });

  afterEach(async () => {
    await teardown(rt, server);
  });

  function makeTurn(
    words: Array<{
      text: string;
      start: number;
      end: number;
      speaker?: string;
    }>,
  ): TurnEvent {
    return {
      type: "Turn",
      turn_order: 1,
      turn_is_formatted: false,
      end_of_turn: true,
      transcript: words.map((w) => w.text).join(" "),
      end_of_turn_confidence: 0.9,
      speaker_label: words[0].speaker ?? "A",
      words: words.map((w) => ({
        start: w.start,
        end: w.end,
        confidence: 1,
        text: w.text,
        word_is_final: true,
        speaker: w.speaker ?? "A",
      })),
    };
  }

  it("fills an unknown word when the speaker has dominant session evidence", async () => {
    const received: TurnEvent[] = [];
    rt.on("turn", (t) => received.push(t));

    // Drive ~200ms of mic-loud audio so speaker A's first words accumulate
    // strong mic-side evidence.
    for (let i = 0; i < 10; i++) {
      rt.sendAudio(loudPcm(320), { channel: "mic" });
      rt.sendAudio(silentPcm(320), { channel: "system" });
    }

    // First turn: two confident mic words for speaker A. After this, A has
    // strong mic evidence in the speaker-history map.
    server.send(
      JSON.stringify(
        makeTurn([
          { text: "hello", start: 20, end: 80 },
          { text: "there", start: 100, end: 180 },
        ]),
      ),
    );
    expect(received[0].words[0].channel).toBe("mic");

    // Second turn: speaker A says one word outside any VAD coverage → unknown
    // via per-word VAD, but speaker-history should fill it as mic.
    server.send(
      JSON.stringify(
        makeTurn([{ text: "yeah", start: 100_000, end: 100_500 }]),
      ),
    );
    const turn = received[1];
    expect(turn.words[0].channel).toBe("mic");
    expect(turn.words[0].channelResolved).toBe(true);
  });

  it("does not fill when the speaker has split evidence across channels", async () => {
    const received: TurnEvent[] = [];
    rt.on("turn", (t) => received.push(t));

    // Drive equal loud audio on both channels.
    for (let i = 0; i < 20; i++) {
      rt.sendAudio(loudPcm(320), { channel: "mic" });
      rt.sendAudio(loudPcm(320), { channel: "system" });
    }

    // First turn covers the dual-loud period; per-word VAD will tie → unknown.
    server.send(
      JSON.stringify(makeTurn([{ text: "both", start: 20, end: 380 }])),
    );
    expect(received[0].words[0].channel).toBe("unknown");

    // Future word with no VAD evidence — speaker A's history is split, so no fill.
    server.send(
      JSON.stringify(makeTurn([{ text: "x", start: 100_000, end: 100_400 }])),
    );
    expect(received[1].words[0].channel).toBe("unknown");
    expect(received[1].words[0].channelResolved).toBeUndefined();
  });

  it("does not modify confident per-word VAD decisions", async () => {
    const received: TurnEvent[] = [];
    rt.on("turn", (t) => received.push(t));

    // Build heavy SYSTEM evidence first.
    for (let i = 0; i < 20; i++) {
      rt.sendAudio(silentPcm(320), { channel: "mic" });
      rt.sendAudio(loudPcm(320), { channel: "system" });
    }
    server.send(
      JSON.stringify(makeTurn([{ text: "hi", start: 20, end: 380 }])),
    );
    expect(received[0].words[0].channel).toBe("system");

    // Now feed mic-loud audio.
    for (let i = 0; i < 5; i++) {
      rt.sendAudio(loudPcm(320), { channel: "mic" });
      rt.sendAudio(silentPcm(320), { channel: "system" });
    }
    // Per-word VAD will confidently say "mic" for the new turn. Speaker
    // history might still favor system (5 mic frames << 20 system frames),
    // but speaker-history must not override confident VAD decisions.
    server.send(
      JSON.stringify(makeTurn([{ text: "actually", start: 460, end: 560 }])),
    );
    expect(received[1].words[0].channel).toBe("mic");
    expect(received[1].words[0].channelResolved).toBeUndefined();
  });

  it("never modifies speaker_label", async () => {
    const received: TurnEvent[] = [];
    rt.on("turn", (t) => received.push(t));

    for (let i = 0; i < 20; i++) {
      rt.sendAudio(loudPcm(320), { channel: "mic" });
      rt.sendAudio(silentPcm(320), { channel: "system" });
    }
    server.send(
      JSON.stringify(makeTurn([{ text: "hi", start: 20, end: 380 }])),
    );
    expect(received[0].speaker_label).toBe("A");
    expect(received[0].words[0].speaker).toBe("A");
  });
});
