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

  it("should normalize deprecated minEndOfTurnSilenceWhenConfident to min_turn_silence in connection URL", async () => {
    await cleanup();
    WS.clean();

    const wsUrl = `${websocketBaseUrl}?token=123&sample_rate=16000&speech_model=universal-streaming-english&min_turn_silence=200`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
      minEndOfTurnSilenceWhenConfident: 200,
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should prefer minTurnSilence when both are set", async () => {
    await cleanup();
    WS.clean();

    const wsUrl = `${websocketBaseUrl}?token=123&sample_rate=16000&speech_model=universal-streaming-english&min_turn_silence=500`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
      minEndOfTurnSilenceWhenConfident: 200,
      minTurnSilence: 500,
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should normalize deprecated min_end_of_turn_silence_when_confident in updateConfiguration", async () => {
    rt.updateConfiguration({ min_end_of_turn_silence_when_confident: 200 });
    await expect(server).toReceiveMessage(
      JSON.stringify({
        type: "UpdateConfiguration",
        min_turn_silence: 200,
      }),
    );
  });

  it("should include redact_pii params and include_partial_turns in connection URL", async () => {
    await cleanup();
    WS.clean();

    const policies = ["email_address", "phone_number"] as const;
    const wsUrl =
      `${websocketBaseUrl}?token=123&sample_rate=16000` +
      `&speech_model=universal-streaming-english` +
      `&include_partial_turns=false` +
      `&redact_pii=true` +
      `&redact_pii_policies=${encodeURIComponent(JSON.stringify(policies))}` +
      `&redact_pii_sub=entity_name`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
      includePartialTurns: false,
      redactPii: true,
      redactPiiPolicies: [...policies],
      redactPiiSub: "entity_name",
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should include interruption_delay in connection URL", async () => {
    await cleanup();
    WS.clean();

    const wsUrl =
      `${websocketBaseUrl}?token=123&sample_rate=16000` +
      `&speech_model=u3-rt-pro` +
      `&interruption_delay=500`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      interruptionDelay: 500,
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should include interruption_delay in updateConfiguration message", async () => {
    rt.updateConfiguration({ interruption_delay: 250 });
    await expect(server).toReceiveMessage(
      JSON.stringify({
        type: "UpdateConfiguration",
        interruption_delay: 250,
      }),
    );
  });

  it("should include agent_context in updateConfiguration message", async () => {
    rt.updateConfiguration({ agent_context: "What is your account number?" });
    await expect(server).toReceiveMessage(
      JSON.stringify({
        type: "UpdateConfiguration",
        agent_context: "What is your account number?",
      }),
    );
  });

  it("should include agent_context in connection URL", async () => {
    await cleanup();
    WS.clean();

    const wsUrl =
      `${websocketBaseUrl}?token=123&sample_rate=16000` +
      `&agent_context=${encodeURIComponent("What is your account number?")}` +
      `&speech_model=u3-rt-pro`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      agentContext: "What is your account number?",
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should include turn_left_pad_ms in connection URL", async () => {
    await cleanup();
    WS.clean();

    const wsUrl =
      `${websocketBaseUrl}?token=123&sample_rate=16000` +
      `&speech_model=u3-rt-pro` +
      `&turn_left_pad_ms=1024`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      turnLeftPadMs: 1024,
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should include turn_left_pad_ms in updateConfiguration message", async () => {
    rt.updateConfiguration({ turn_left_pad_ms: 1024 });
    await expect(server).toReceiveMessage(
      JSON.stringify({
        type: "UpdateConfiguration",
        turn_left_pad_ms: 1024,
      }),
    );
  });

  it("should include voice_focus and voice_focus_threshold in connection URL", async () => {
    await cleanup();
    WS.clean();

    const wsUrl = `${websocketBaseUrl}?token=123&sample_rate=16000&speech_model=universal-streaming-english&voice_focus=near-field&voice_focus_threshold=0.5`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
      voiceFocus: "near-field",
      voiceFocusThreshold: 0.5,
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should include mode in connection URL", async () => {
    await cleanup();
    WS.clean();

    const wsUrl = `${websocketBaseUrl}?token=123&sample_rate=16000&speech_model=u3-rt-pro&mode=max_accuracy`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      mode: "max_accuracy",
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should include language_code in connection URL", async () => {
    await cleanup();
    WS.clean();

    const wsUrl = `${websocketBaseUrl}?token=123&sample_rate=16000&speech_model=u3-rt-pro&language_code=es`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "u3-rt-pro",
      languageCode: "es",
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

  it("should include universal-3-5-pro speech model in connection URL", async () => {
    await cleanup();
    WS.clean();

    const wsUrl = `${websocketBaseUrl}?token=123&sample_rate=16000&speech_model=universal-3-5-pro`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-3-5-pro" as const,
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

  it("should include llm_gateway in connection URL", async () => {
    await cleanup();
    WS.clean();

    const llmGatewayConfig = {
      model: "claude-3-5-sonnet",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ],
      max_tokens: 100,
    };

    const wsUrl = `${websocketBaseUrl}?token=123&sample_rate=16000&speech_model=universal-streaming-english&llm_gateway=${encodeURIComponent(JSON.stringify(llmGatewayConfig))}`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
      llmGateway: llmGatewayConfig,
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it("should parse LLMGatewayResponse event", async () => {
    const llmResponsePromise = new Promise<{
      turn_order: number;
      transcript: string;
      data: unknown;
    }>((resolve) => {
      rt.on("llmGatewayResponse", (event) => resolve(event));
    });

    const llmResponseData = {
      type: "LLMGatewayResponse",
      turn_order: 1,
      transcript: "hello world",
      data: {
        response: "This is an LLM response",
        model: "claude-3-5-sonnet",
      },
    };

    server.send(JSON.stringify(llmResponseData));
    const response = await llmResponsePromise;
    expect(response.turn_order).toBe(1);
    expect(response.transcript).toBe("hello world");
    expect(response.data).toEqual({
      response: "This is an LLM response",
      model: "claude-3-5-sonnet",
    });
  });

  it("should parse and dispatch SpeakerRevision event", async () => {
    const revisionPromise = new Promise<{
      revisions: {
        turn_order: number;
        speaker_label?: string;
        words: { speaker?: string }[];
      }[];
    }>((resolve) => {
      rt.on("speakerRevision", (event) => resolve(event));
    });

    // One message per recluster resolve, carrying a list of revised turns.
    // Revision words use the same word schema as Turn.
    server.send(
      JSON.stringify({
        type: "SpeakerRevision",
        revisions: [
          {
            turn_order: 3,
            speaker_label: "B",
            words: [
              {
                start: 1000,
                end: 1200,
                confidence: 0.9,
                text: "hello",
                word_is_final: true,
                speaker: "B",
              },
              {
                start: 1210,
                end: 1400,
                confidence: 0.88,
                text: "world",
                word_is_final: true,
                speaker: "A",
              },
            ],
          },
          {
            turn_order: 7,
            speaker_label: "A",
            words: [],
          },
        ],
      }),
    );

    const event = await revisionPromise;
    expect(event.revisions.map((r) => r.turn_order)).toEqual([3, 7]);
    expect(event.revisions[0].speaker_label).toBe("B");
    expect(event.revisions[0].words.map((w) => w.speaker)).toEqual(["B", "A"]);
    expect(event.revisions[1].speaker_label).toBe("A");
    expect(event.revisions[1].words).toEqual([]);
  });
});
