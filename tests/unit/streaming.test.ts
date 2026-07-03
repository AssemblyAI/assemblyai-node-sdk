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

  // Leave the shared `rt`/`server` in a connected state so the trailing
  // afterEach `cleanup()` (which expects a live session) succeeds after a
  // test that deliberately drove `rt` into a failed/closed connection.
  async function reestablish() {
    WS.clean();
    server = new WS(websocketBaseUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      apiKey: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
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

  it("should include language_codes in updateConfiguration message", async () => {
    rt.updateConfiguration({ language_codes: ["en", "es"] });
    await expect(server).toReceiveMessage(
      JSON.stringify({
        type: "UpdateConfiguration",
        language_codes: ["en", "es"],
      }),
    );
  });

  it("should send an empty language_codes array in updateConfiguration to clear steering", async () => {
    rt.updateConfiguration({ language_codes: [] });
    await expect(server).toReceiveMessage(
      JSON.stringify({
        type: "UpdateConfiguration",
        language_codes: [],
      }),
    );
  });

  it("should send KeepAlive message on keepAlive()", async () => {
    rt.keepAlive();
    await expect(server).toReceiveMessage(
      JSON.stringify({
        type: "KeepAlive",
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

  it("should include language_codes in connection URL", async () => {
    await cleanup();
    WS.clean();

    const languageCodes = ["en", "es"];
    const wsUrl =
      `${websocketBaseUrl}?token=123&sample_rate=16000&speech_model=universal-3-5-pro` +
      `&language_codes=${encodeURIComponent(JSON.stringify(languageCodes))}`;
    server = new WS(wsUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-3-5-pro",
      languageCodes: ["en", "es"],
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);
    await connect(rt, server);
  });

  it.each(["opus", "ogg_opus"] as const)(
    "should include %s encoding in connection URL",
    async (encoding) => {
      await cleanup();
      WS.clean();

      const wsUrl = `${websocketBaseUrl}?token=123&sample_rate=16000&encoding=${encoding}`;
      server = new WS(wsUrl);
      rt = new StreamingTranscriber({
        websocketBaseUrl,
        token: "123",
        sampleRate: 16_000,
        encoding,
      });
      onOpen = jest.fn();
      rt.on("open", onOpen);
      await connect(rt, server);
    },
  );

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

  it("rejects when the handshake times out (retries disabled)", async () => {
    await cleanup();
    WS.clean();
    server = new WS(websocketBaseUrl);

    // Connect but never send `Begin`; the attempt should time out and reject.
    const failing = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
      connectTimeout: 30,
      maxConnectionRetries: 0,
    });
    await expect(failing.connect()).rejects.toThrow(/timed out/i);

    await reestablish();
  });

  it("does not retry a permanent auth failure", async () => {
    await cleanup();
    WS.clean();
    server = new WS(websocketBaseUrl);

    const failing = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
      connectTimeout: 1000,
      maxConnectionRetries: 5,
      connectionRetryDelay: 0,
    });
    const connectPromise = failing.connect();
    await server.connected;
    // Server rejects the handshake with an auth close before `Begin`.
    server.close({
      code: 4001,
      reason: null as unknown as string,
      wasClean: false,
    });

    // Rejects with the auth error (code 4001) rather than retrying until a
    // timeout — proving the permanent-failure short-circuit.
    await expect(connectPromise).rejects.toMatchObject({ code: 4001 });

    await reestablish();
  });

  it("retries a transient handshake failure and then succeeds", async () => {
    await cleanup();
    WS.clean();
    server = new WS(websocketBaseUrl);

    // Drive the underlying mock-socket server per-connection: close the first
    // connection with a transient code (no `Begin`), then accept the retry by
    // sending `Begin`. Deterministic — no reliance on retry/connection timing.
    let connectionCount = 0;
    const mockServer = (
      server as unknown as {
        server: {
          on: (
            event: "connection",
            cb: (socket: {
              close: (options: {
                code: number;
                reason: string;
                wasClean: boolean;
              }) => void;
              send: (data: string) => void;
            }) => void,
          ) => void;
        };
      }
    ).server;
    mockServer.on("connection", (socket) => {
      connectionCount++;
      if (connectionCount === 1) {
        socket.close({ code: 1011, reason: "transient", wasClean: false });
      } else {
        socket.send(JSON.stringify(sessionBeginsMessage));
      }
    });

    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
      connectTimeout: 1000,
      maxConnectionRetries: 2,
      connectionRetryDelay: 0,
    });
    onOpen = jest.fn();
    rt.on("open", onOpen);

    const begin = await rt.connect();

    expect(begin.type).toBe("Begin");
    expect(connectionCount).toBeGreaterThanOrEqual(2);
    expect(onOpen).toHaveBeenCalled();
    // Leaves rt/server connected for the shared afterEach cleanup.
  });
});
