jest.mock("ws", () => require("./mocks/ws"));

import WS from "jest-websocket-mock";
import fetchMock from "jest-fetch-mock";
import { AssemblyAI, StreamingTranscriber } from "../../src";
import { createClient } from "./utils";

fetchMock.enableMocks();

const websocketBaseUrl = "wss://localhost:1234/v3/ws";

const sessionBeginsMessage = {
  type: "Begin",
  id: "123",
  expires_at: 123456789,
};

const sessionTerminatedMessage = {
  type: "Termination",
};

let server: WS;
let aai: AssemblyAI;
let rt: StreamingTranscriber;
let onOpen: jest.Mock;

async function connect(rt: StreamingTranscriber, server: WS) {
  const connectPromise = rt.connect();
  await server.connected;
  server.send(JSON.stringify(sessionBeginsMessage));
  await connectPromise;
}

async function close(rt: StreamingTranscriber, server: WS) {
  const closePromise = rt.close();
  server.send(JSON.stringify(sessionTerminatedMessage));
  await closePromise;
  await server.closed;
}

describe("streaming", () => {
  beforeEach(async () => {
    server = new WS(websocketBaseUrl);
    aai = createClient();
    rt = aai.streaming.transcriber({
      websocketBaseUrl: websocketBaseUrl,
      apiKey: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });
  afterEach(async () => await cleanup());

  async function cleanup() {
    await close(rt, server);
    WS.clean();
  }

  it("noop", async () => {});

  it("should include speaker_labels in connection URL", async () => {
    await cleanup();
    WS.clean();

    const wsUrl = `${websocketBaseUrl}?token=123&sample_rate=16000&speech_model=universal-streaming-english&speaker_labels=true`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
      speakerLabels: true,
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should include speaker_labels and max_speakers in connection URL", async () => {
    await cleanup();
    WS.clean();

    const wsUrl = `${websocketBaseUrl}?token=123&sample_rate=16000&speech_model=universal-streaming-english&speaker_labels=true&max_speakers=4`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
      speakerLabels: true,
      maxSpeakers: 4,
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should include whisper-rt speech model in connection URL", async () => {
    await cleanup();
    WS.clean();

    const wsUrl = `${websocketBaseUrl}?token=123&sample_rate=16000&speech_model=whisper-rt`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "whisper-rt" as const,
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should parse speaker_label from turn event", async () => {
    const turnPromise = new Promise<{ speaker_label?: string }>((resolve) => {
      rt.on("turn", (event) => resolve(event));
    });
    server.send(
      JSON.stringify({
        type: "Turn",
        turn_order: 1,
        turn_is_formatted: true,
        end_of_turn: true,
        transcript: "hello",
        end_of_turn_confidence: 0.9,
        words: [],
        speaker_label: "A",
      }),
    );
    const turn = await turnPromise;
    expect(turn.speaker_label).toBe("A");
  });
});
