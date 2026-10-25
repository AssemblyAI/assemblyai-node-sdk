jest.mock("ws", () => require("./mocks/ws"));

import WS from "jest-websocket-mock";
import fetchMock from "jest-fetch-mock";
import {
  AssemblyAI,
  TextToSpeechError,
  TextToSpeechSession,
  TtsBeginEvent,
} from "../../src";
import * as websocketPolyfill from "../../src/polyfills/websocket/default";
import { conditions } from "#conditions";
import { createClient, defaultApiKey, defaultBaseUrl } from "./utils";

fetchMock.enableMocks();

const websocketBaseUrl = "wss://localhost:1234/v1/ws";

const beginMessage = {
  type: "Begin",
  id: "sess-1",
  expires_at: 1789556741,
  configuration: {
    voice_id: "aai-jane",
    model: "assemblyai-tts-1",
    limits: { max_generate_text_length: 2000 },
  },
};
const terminationMessage = {
  type: "Termination",
  session_duration_seconds: 3,
  total_input_char_length: 20,
  audio_duration_seconds: 1.5,
};

type ServerSocket = {
  send: (data: string) => void;
  close: (options?: {
    code: number;
    reason: string;
    wasClean: boolean;
  }) => void;
  /** The URL the client connected to. */
  url: string;
  /** The options the client passed to the ws constructor (its headers). */
  clientOptions?: unknown;
};

/**
 * Plays the API: Generate/Flush answer with the text's bytes as one Audio
 * frame and a FlushDone, Cancel with Cancelled, Terminate with Termination
 * and a clean close.
 */
class FakeApi {
  text = "";
  flushId = 0;
  answerFlush = true;
  /** Off, Cancel gets no Cancelled: the test plays the audio still in transit. */
  answerCancel = true;
  /** Off, Terminate gets no answer: the test plays the drain. */
  answerTerminate = true;
  closeOnTerminate = true;
  /** Refuse a temporary token seen before, as the API may. */
  singleUseTokens = false;
  private usedTokens = new Set<string>();
  sent: Record<string, unknown>[] = [];
  /** The server side of each connection, in order. */
  sockets: ServerSocket[] = [];
  /** Closes the server saw, from either side. */
  closes = 0;

  constructor(public server: WS) {
    server.on("close", () => {
      this.closes += 1;
    });
    server.on("connection", (socket) => {
      this.sockets.push(socket);
      this.text = ""; // a new connection is a new session: ids start at 0
      this.flushId = 0;
      const token = new URL(socket.url).searchParams.get("token");
      if (this.singleUseTokens && token !== null) {
        if (this.usedTokens.has(token)) {
          socket.send(
            JSON.stringify({
              type: "Error",
              error_code: 1008,
              error: "Unauthorized: token already used",
              error_type: "unauthorized",
              retryable: false,
              param: null,
              retry_after_seconds: null,
            }),
          );
          socket.close({ code: 1008, reason: "", wasClean: true });
          return;
        }
        this.usedTokens.add(token);
      }
      socket.on("message", (raw) => {
        const frame = JSON.parse(String(raw)) as Record<string, unknown>;
        this.sent.push(frame);
        this.handle(frame, socket);
      });
    });
  }

  private handle(frame: Record<string, unknown>, socket: ServerSocket) {
    switch (frame.type) {
      case "Generate":
        this.text += frame.text as string;
        return;
      case "Flush":
        if (this.answerFlush) {
          socket.send(
            JSON.stringify({
              type: "Audio",
              audio: Buffer.from(this.text).toString("base64"),
              flush_id: this.flushId,
            }),
          );
          socket.send(
            JSON.stringify({
              type: "FlushDone",
              flush_id: this.flushId,
              audio_duration_ms: 80,
            }),
          );
        }
        this.flushId += 1;
        this.text = "";
        return;
      case "Cancel":
        this.flushId += 1;
        this.text = "";
        if (this.answerCancel) {
          socket.send(
            JSON.stringify({ type: "Cancelled", audio_duration_seconds: 0.1 }),
          );
        }
        return;
      case "Terminate":
        if (!this.answerTerminate) return;
        socket.send(JSON.stringify(terminationMessage));
        if (this.closeOnTerminate) {
          socket.close({ code: 1000, reason: "Session ended", wasClean: true });
        }
        return;
    }
  }

  frames(type: string) {
    return this.sent.filter((f) => f.type === type);
  }
}

let server: WS;
let api: FakeApi;
let client: AssemblyAI;

async function connect(
  session: TextToSpeechSession,
  begin: unknown = beginMessage,
) {
  const promise = session.connect();
  await server.connected;
  if (begin) server.send(JSON.stringify(begin));
  return promise;
}

async function collect(iterable: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

/** The User-Agent the client builds by default, as the HTTP calls send it. */
const sdkUserAgent = expect.stringMatching(
  /AssemblyAI\/1\.0 \(sdk=JavaScript\/\S+/,
);

/** The server side of connection `n` (1-based), once the client opened it. */
async function connection(n: number): Promise<ServerSocket> {
  for (let waited = 0; api.sockets.length < n; waited += 5) {
    if (waited > 500) throw new Error(`connection ${n} was never opened`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return api.sockets[n - 1];
}

/** What the promise settled with, or "pending" if it did not settle in time. */
function outcome<T>(promise: Promise<T>, ms = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.catch((error: unknown) => error),
    new Promise<"pending">((resolve) => {
      timer = setTimeout(() => resolve("pending"), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

let consoleError: jest.SpyInstance | undefined;

/** Records console.error calls without printing them; restored after each test. */
function spyConsoleError(): jest.SpyInstance {
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  return consoleError;
}

function errorFrame(code: number, errorType: string, retryable: boolean) {
  return JSON.stringify({
    type: "Error",
    error_code: code,
    error: `Failed: ${errorType}`,
    error_type: errorType,
    retryable,
    param: null,
    retry_after_seconds: null,
  });
}

describe("tts session", () => {
  beforeEach(() => {
    server = new WS(websocketBaseUrl);
    api = new FakeApi(server);
    client = createClient();
  });
  afterEach(() => {
    WS.clean();
    consoleError?.mockRestore();
    consoleError = undefined;
  });

  it("connects, waits for Begin, speaks and terminates", async () => {
    const session = client.tts.session({
      websocketBaseUrl,
      voiceId: "aai-alba",
      sampleRate: 8000,
    });
    const begin = await connect(session);
    expect(begin.id).toBe("sess-1");
    expect(session.begin?.configuration.model).toBe("assemblyai-tts-1");
    const url = new URL(
      (session as unknown as { socket: { url: string } }).socket.url,
    );
    expect(url.pathname).toBe("/v1/ws");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      voice_id: "aai-alba",
      sample_rate: "8000",
      word_boundaries: "false",
    });

    expect((await collect(session.speak("Hello there."))).toString()).toBe(
      "Hello there.",
    );
    expect(api.frames("Generate")).toEqual([
      { type: "Generate", text: "Hello there." },
    ]);

    const termination = await session.close();
    expect(termination?.total_input_char_length).toBe(20);
    expect(session.termination).toEqual(termination);
    expect(api.frames("Terminate")).toHaveLength(1);
    await server.closed;
  });

  it("pipelines requests and reads them in flush id order", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    session.generate("One. ");
    const first = session.flush();
    session.generate("Two.");
    const second = session.flush();
    expect([first, second]).toEqual([0, 1]);
    expect((await collect(session.audio(first))).toString()).toBe("One. ");
    expect((await collect(session.audio(second))).toString()).toBe("Two.");
    await session.close();
  });

  it("cancel ends the current iteration at once and drops every pipelined request", async () => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    const first = session.flush();
    const second = session.flush();
    const stream = session.audio(first);
    server.send(
      JSON.stringify({
        type: "Audio",
        audio: Buffer.from("A").toString("base64"),
        flush_id: 0,
      }),
    );
    expect(
      Buffer.from((await stream.next()).value as Uint8Array).toString(),
    ).toBe("A");
    session.cancel();
    expect((await stream.next()).done).toBe(true);
    expect((await collect(session.audio(second))).length).toBe(0); // also dropped, no hang

    api.answerFlush = true;
    expect((await collect(session.speak("Next."))).toString()).toBe("Next.");
    expect(api.frames("Cancel")).toHaveLength(1);
    await session.close();
  });

  it("a cancel before a request does not end it", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    session.cancel();
    expect((await collect(session.speak("Hi."))).toString()).toBe("Hi.");
    await session.close();
  });

  it("audio() without an id follows the request being written", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    const reading = collect(session.audio());
    session.generate("Early ");
    session.generate("audio.");
    session.flush();
    expect((await reading).toString()).toBe("Early audio.");
    await session.close();
  });

  it("speak splits long text across Generate frames", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    const text = "a".repeat(2000) + "b".repeat(500);
    expect((await collect(session.speak(text))).toString()).toBe(text);
    expect(
      api.frames("Generate").map((f) => (f.text as string).length),
    ).toEqual([2000, 500]);
    expect(() => session.generate("x".repeat(2001))).toThrow(RangeError);
    await session.close();
  });

  it("an Error frame before Begin rejects connect()", async () => {
    const session = client.tts.session({
      websocketBaseUrl,
      voiceId: "aai-nobody",
    });
    const promise = session.connect();
    await server.connected;
    server.send(
      JSON.stringify({
        type: "Error",
        error_code: 3012,
        error: "The requested voice was not found.",
        error_type: "voice_not_found",
        retryable: false,
        param: "voice_id",
        retry_after_seconds: null,
      }),
    );
    server.close({
      code: 3012,
      reason: "See Error message for details",
      wasClean: true,
    });
    const error = (await promise.catch((e) => e)) as TextToSpeechError;
    expect(error).toBeInstanceOf(TextToSpeechError);
    expect(error).toMatchObject({
      errorCode: "voice_not_found",
      param: "voice_id",
      retryable: false,
      closeCode: 3012,
    });
  });

  it("an Error frame mid-session rejects the audio and reaches the error listener", async () => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    const errors: TextToSpeechError[] = [];
    session.on("error", (e) => errors.push(e));
    await connect(session);
    const flushId = session.flush();
    server.send(
      JSON.stringify({
        type: "Error",
        error_code: 3005,
        error: "No room",
        error_type: "at_capacity",
        retryable: true,
        param: null,
        retry_after_seconds: 2,
      }),
    );
    const error = (await collect(session.audio(flushId)).catch(
      (e) => e,
    )) as TextToSpeechError;
    expect(error.errorCode).toBe("at_capacity");
    expect(error.retryAfter).toBe(2);
    expect(error.requestId).toBe("sess-1");
    expect(errors).toEqual([error]);
    expect(() => session.generate("late")).toThrow(error);
    await expect(session.close()).resolves.toBeUndefined(); // already surfaced
  });

  it("a failure nobody observed rejects close()", async () => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    session.on("audio", () => undefined); // push mode
    await connect(session);
    session.generate("Never read.");
    session.flush();
    server.send(
      JSON.stringify({
        type: "Error",
        error_code: 3010,
        error: "Too fast",
        error_type: "input_rate_exceeded",
        retryable: false,
        param: null,
        retry_after_seconds: null,
      }),
    );
    await tick();
    await expect(session.close()).rejects.toMatchObject({
      errorCode: "input_rate_exceeded",
    });
  });

  it("an audio listener receives the frames and pulling is refused", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    const received: Uint8Array[] = [];
    const done: number[] = [];
    session.on("audio", (e) => received.push(e.audio));
    session.on("flushDone", (e) => done.push(e.audio_duration_ms));
    await connect(session);
    session.generate("Pushed.");
    const flushId = session.flush();
    await expect(session.audio(flushId).next()).rejects.toThrow(
      /audio listener/,
    );
    await tick();
    expect(Buffer.from(received[0]).toString()).toBe("Pushed.");
    expect(done).toEqual([80]);
    await session.close();
  });

  it("a lost connection is a retryable error", async () => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    const flushId = session.flush();
    server.close({ code: 1006, reason: "", wasClean: false });
    const error = (await collect(session.audio(flushId)).catch(
      (e) => e,
    )) as TextToSpeechError;
    expect(error.retryable).toBe(true);
    expect(error.closeCode).toBe(1006);
  });

  it("a token session reconnects with a new token, sent in the query alone", async () => {
    api.singleUseTokens = true;
    const session = client.tts.session({
      websocketBaseUrl,
      token: "tmp-1",
      inactivityTimeout: 30,
    });
    await connect(session);
    const first = await connection(1);
    const url = new URL(first.url);
    expect(url.searchParams.get("token")).toBe("tmp-1");
    expect(url.searchParams.get("inactivity_timeout")).toBe("30");
    // No Authorization header: it would override the token.
    expect(first.clientOptions).toEqual({
      headers: { "User-Agent": sdkUserAgent },
    });
    expect((await collect(session.speak("One."))).toString()).toBe("One.");
    await session.close();

    // Same object, new connection, new token.
    const reconnect = session.connect({ token: "tmp-2" });
    const second = await connection(2);
    expect(new URL(second.url).searchParams.get("token")).toBe("tmp-2");
    second.send(JSON.stringify(beginMessage));
    await reconnect;
    expect((await collect(session.speak("Two."))).toString()).toBe("Two.");
    await session.close();

    // The new token stays the session's token, and a used token is refused.
    const reused = session.connect().catch((error: unknown) => error);
    const third = await connection(3);
    expect(new URL(third.url).searchParams.get("token")).toBe("tmp-2");
    expect(await reused).toMatchObject({
      closeCode: 1008,
      errorCode: "unauthorized",
      retryable: false,
    });
  });

  it("the error listener reconnects a token session with a token minted then", async () => {
    api.singleUseTokens = true;
    // As in a browser: no client and no API key.
    const session = new TextToSpeechSession({
      websocketBaseUrl,
      token: "tmp-1",
    });
    let minted = 1;
    const mintToken = async () => `tmp-${++minted}`;
    let reconnecting: Promise<TtsBeginEvent> | undefined;
    session.on("error", (error) => {
      if (error.retryable) {
        reconnecting = mintToken().then((token) => session.connect({ token }));
      }
    });
    await connect(session);
    api.sockets[0].send(errorFrame(1012, "service_restart", true));
    api.sockets[0].close({ code: 1012, reason: "", wasClean: true });

    const second = await connection(2);
    expect(new URL(second.url).searchParams.get("token")).toBe("tmp-2");
    second.send(JSON.stringify(beginMessage));
    await expect(reconnecting).resolves.toMatchObject({ id: "sess-1" });
    expect((await collect(session.speak("Back."))).toString()).toBe("Back.");
    await session.close();
  });

  it("connect({ token }) sends the token instead of the API key", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    const first = await connection(1);
    expect(new URL(first.url).searchParams.has("token")).toBe(false);
    expect(first.clientOptions).toEqual({
      headers: { Authorization: defaultApiKey, "User-Agent": sdkUserAgent },
    });
    await session.close();

    const reconnect = session.connect({ token: "tmp" });
    const second = await connection(2);
    expect(new URL(second.url).searchParams.get("token")).toBe("tmp");
    expect(second.clientOptions).toEqual({
      headers: { "User-Agent": sdkUserAgent },
    });
    second.send(JSON.stringify(beginMessage));
    await reconnect;
    await session.close();
  });

  describe("the handshake's User-Agent", () => {
    it("is the client's, on both the API key and the token path", async () => {
      const custom = new AssemblyAI({
        apiKey: defaultApiKey,
        ttsBaseUrl: defaultBaseUrl,
        userAgent: { integration: { name: "Pipecat", version: "1.2.3" } },
      });
      const session = custom.tts.session({ websocketBaseUrl });
      await connect(session);
      const userAgent = (
        (await connection(1)).clientOptions as {
          headers: Record<string, string>;
        }
      ).headers["User-Agent"];
      expect(userAgent).toEqual(sdkUserAgent);
      expect(userAgent).toContain("integration=Pipecat/1.2.3");
      await session.close();

      const reconnect = session.connect({ token: "tmp" });
      const second = await connection(2);
      expect(second.clientOptions).toEqual({
        headers: { "User-Agent": userAgent },
      });
      second.send(JSON.stringify(beginMessage));
      await reconnect;
      await session.close();
    });

    it("is not sent with userAgent: false", async () => {
      const anonymous = new AssemblyAI({
        apiKey: defaultApiKey,
        ttsBaseUrl: defaultBaseUrl,
        userAgent: false,
      });
      const session = anonymous.tts.session({ websocketBaseUrl });
      await connect(session);
      expect((await connection(1)).clientOptions).toEqual({
        headers: { Authorization: defaultApiKey },
      });
      await session.close();

      const reconnect = session.connect({ token: "tmp" });
      const second = await connection(2);
      expect(second.clientOptions).toBeUndefined();
      second.send(JSON.stringify(beginMessage));
      await reconnect;
      await session.close();
    });

    it("is not sent by a session created without a client", async () => {
      const session = new TextToSpeechSession({
        websocketBaseUrl,
        token: "tmp",
      });
      await connect(session);
      expect((await connection(1)).clientOptions).toBeUndefined();
      await session.close();
    });

    it("is left to the browser, whose WebSocket takes no headers", async () => {
      // The browser polyfill passes a second argument as the subprotocols.
      conditions.browser = true;
      try {
        const session = client.tts.session({ websocketBaseUrl, token: "tmp" });
        await connect(session);
        expect((await connection(1)).clientOptions).toBeUndefined();
        await session.close();
      } finally {
        conditions.browser = false;
      }
    });
  });

  it("a connect({ token }) refused while connected keeps the session's token", async () => {
    const session = client.tts.session({ websocketBaseUrl, token: "tmp-1" });
    await connect(session);
    await expect(session.connect({ token: "tmp-2" })).rejects.toThrow(
      /already connected/,
    );
    await session.close();

    const reconnect = session.connect();
    const second = await connection(2);
    expect(new URL(second.url).searchParams.get("token")).toBe("tmp-1");
    second.send(JSON.stringify(beginMessage));
    await reconnect;
    await session.close();
  });

  it("a send before connect says what to do", () => {
    const session = client.tts.session({ websocketBaseUrl });
    expect(() => session.generate("Hi.")).toThrow(/connect\(\)/);
  });

  it("a send while the socket is still opening is not reported as a lost connection", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    const connecting = session.connect();
    let thrown: unknown;
    try {
      session.generate("Hi.");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).not.toBeInstanceOf(TextToSpeechError);
    expect(thrown).toMatchObject({ message: /connect\(\)/ });
    await server.connected;
    server.send(JSON.stringify(beginMessage));
    await connecting;
    await session.close();
  });

  it("cancel ends a reader following the request being written", async () => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    const reading = collect(session.audio()); // no id: the text being written
    session.generate("Interrupted before the flush.");
    session.cancel();
    expect((await reading).length).toBe(0); // ends at once instead of hanging
    api.answerFlush = true;
    expect((await collect(session.speak("Next."))).toString()).toBe("Next.");
    await session.close();
  });

  it("refuses a second concurrent reader instead of losing audio", async () => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    const first = session.flush();
    const second = session.flush();
    const readerA = session.audio(first);
    const pendingA = readerA.next();
    await expect(session.audio(second).next()).rejects.toThrow(
      /one audio\(\) iteration at a time/,
    );
    session.cancel();
    expect((await pendingA).done).toBe(true);
    await session.close();
  });

  it("speak with an audio listener throws before sending anything", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    session.on("audio", () => undefined);
    await connect(session);
    expect(() => session.speak("Hi.")).toThrow(/audio listener/);
    expect(api.frames("Generate")).toHaveLength(0);
    await session.close();
  });

  it("speak splits on code points, never inside a surrogate pair", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    const text = "a".repeat(1999) + "\u{1F600}" + "b";
    expect((await collect(session.speak(text))).toString()).toBe(text);
    const pieces = api.frames("Generate").map((f) => f.text as string);
    expect(pieces).toHaveLength(2);
    expect(pieces[0].endsWith("\u{1F600}")).toBe(true); // the emoji stays whole
    expect(() => session.generate("\u{1F600}".repeat(2001))).toThrow(
      RangeError,
    );
    expect(() => session.generate("\u{1F600}".repeat(2000))).not.toThrow();
    await session.close();
  });

  describe("speak() and the API's text backlog", () => {
    const withLimits = (limits: Record<string, unknown>) => ({
      ...beginMessage,
      configuration: {
        ...beginMessage.configuration,
        limits: { max_generate_text_length: 2000, ...limits },
      },
    });

    it("refuses text over the backlog before sending anything", async () => {
      // Given a session whose Begin reports an 8,000-character backlog
      const session = client.tts.session({ websocketBaseUrl });
      await connect(
        session,
        withLimits({
          text_throttle_enabled: true,
          text_max_buffer_chars: 8000,
        }),
      );

      // When the app speaks 8,001 characters at once
      const speaking = () => session.speak("a".repeat(8001));

      // Then speak() throws a RangeError naming the limit, and sends nothing
      expect(speaking).toThrow(RangeError);
      expect(speaking).toThrow(
        /^text is 8001 characters, over the 8000 unspoken characters .* 3010 input_rate_exceeded; split it and speak\(\) each part/,
      );
      await tick();
      expect(api.sent).toEqual([]);

      // And text at the limit, counted in code points as the API counts it,
      // is spoken: 8,000 emoji are 16,000 UTF-16 code units
      const text = "\u{1F600}".repeat(8000);
      expect((await collect(session.speak(text))).toString()).toBe(text);
      expect(api.frames("Generate")).toHaveLength(4);
      await session.close();
    });

    it.each([
      [
        "the throttle is off",
        { text_throttle_enabled: false, text_max_buffer_chars: 8000 },
      ],
      ["Begin reports no backlog", {}],
      [
        "the backlog is 0",
        { text_throttle_enabled: true, text_max_buffer_chars: 0 },
      ],
    ])("sends long text when %s", async (_case, limits) => {
      // Given a session whose API sets no text backlog
      const session = client.tts.session({ websocketBaseUrl });
      await connect(session, withLimits(limits));

      // When the app speaks 8,001 characters
      const text = "a".repeat(8001);

      // Then the text is sent and spoken
      expect((await collect(session.speak(text))).toString()).toBe(text);
      await session.close();
    });
  });

  it("close() rejects a connect() still pending instead of letting it time out", async () => {
    const session = client.tts.session({
      websocketBaseUrl,
      connectTimeout: 5000,
    });
    const pending = session.connect();
    await server.connected;
    const started = Date.now();
    const rejected = expect(pending).rejects.toMatchObject({
      message: /closed before it began/,
    });
    await session.close();
    await rejected;
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("the close listener fires when the client closes the session", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    const closes: [number, string][] = [];
    session.on("close", (code, reason) => closes.push([code, reason]));
    await connect(session);
    await session.close();
    expect(closes).toEqual([[1000, "Session ended"]]);
  });

  it.each([
    { name: "waits for audio", chunkFirst: false },
    { name: "is between chunks", chunkFirst: true },
  ])(
    "a close listener that connects again does not hide the cut from a reader that $name",
    async ({ chunkFirst }) => {
      api.answerFlush = false;
      const session = client.tts.session({ websocketBaseUrl });
      const closes: number[] = [];
      let reconnecting: Promise<TtsBeginEvent> | undefined;
      session.on("close", (code) => {
        closes.push(code);
        if (session.error?.retryable) reconnecting = session.connect();
      });
      await connect(session);
      const flushId = session.flush();
      const stream = session.audio(flushId);
      let reading: Promise<unknown> | undefined;
      if (chunkFirst) {
        // The reader stays suspended at this chunk through the cut, the
        // reconnect and a barge-in on the new connection.
        api.sockets[0].send(
          JSON.stringify({ type: "Audio", audio: "QQ==", flush_id: flushId }),
        );
        expect((await stream.next()).done).toBe(false);
      } else {
        reading = outcome(stream.next());
        await tick();
      }
      api.sockets[0].close({ code: 3005, reason: "", wasClean: true });
      (await connection(2)).send(JSON.stringify(beginMessage));
      await expect(reconnecting).resolves.toMatchObject({ id: "sess-1" });
      session.cancel();

      const error = await (reading ?? outcome(stream.next()));
      expect(error).toBeInstanceOf(TextToSpeechError);
      expect(error).toMatchObject({ closeCode: 3005, retryable: true });
      expect(closes).toEqual([3005]);

      api.answerFlush = true;
      expect((await collect(session.speak("Again."))).toString()).toBe(
        "Again.",
      );
      // Reading the old connection's error does not count as observing a
      // failure of the new one.
      api.sockets[1].send(errorFrame(3010, "input_rate_exceeded", false));
      await expect(session.close()).rejects.toMatchObject({
        errorCode: "input_rate_exceeded",
      });
      expect(closes).toEqual([3005, 3010]);
    },
  );

  it("close() rejects with an unobserved error although the close listener connects again", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    let reconnecting: Promise<TtsBeginEvent> | undefined;
    session.on("audio", () => undefined); // push mode: nothing reads the error
    session.on("close", () => {
      reconnecting ??= session.connect();
    });
    await connect(session);
    api.sockets[0].send(errorFrame(3005, "at_capacity", true));
    await expect(session.close()).rejects.toMatchObject({
      errorCode: "at_capacity",
    });

    (await connection(2)).send(JSON.stringify(beginMessage));
    await expect(reconnecting).resolves.toMatchObject({ id: "sess-1" });
    await expect(session.close()).resolves.toEqual(terminationMessage);
  });

  it.each([
    {
      name: "an Error frame and its close",
      end: (socket: ServerSocket) => {
        socket.send(errorFrame(1012, "service_restart", true));
        socket.close({ code: 1012, reason: "", wasClean: true });
      },
    },
    {
      name: "a dropped connection",
      end: (socket: ServerSocket) =>
        socket.close({ code: 1006, reason: "", wasClean: false }),
    },
  ])("the error listener can connect again after $name", async ({ end }) => {
    const session = client.tts.session({ websocketBaseUrl });
    const errors: TextToSpeechError[] = [];
    let reconnecting: Promise<TtsBeginEvent> | undefined;
    session.on("error", (error) => {
      errors.push(error);
      reconnecting = session.connect();
    });
    await connect(session);
    end(api.sockets[0]);
    await tick();
    expect(errors).toHaveLength(1);
    expect(errors[0].retryable).toBe(true);

    (await connection(2)).send(JSON.stringify(beginMessage));
    await expect(reconnecting).resolves.toMatchObject({ id: "sess-1" });
    expect((await collect(session.speak("Back."))).toString()).toBe("Back.");
    await session.close();
  });

  it("a throwing error listener is logged and does not leave a reader waiting", async () => {
    const logged = spyConsoleError();
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    const thrown = new Error("listener failed");
    session.on("error", () => {
      throw thrown;
    });
    await connect(session);
    const flushId = session.flush();
    const reading = outcome(collect(session.audio(flushId)));
    await tick();
    api.sockets[0].send(errorFrame(3005, "at_capacity", true));
    expect(await reading).toMatchObject({ errorCode: "at_capacity" });
    expect(logged.mock.calls).toEqual([
      ["TextToSpeechSession: the error listener threw", thrown],
    ]);
    await session.close();
  });

  it("an audio listener that throws keeps receiving frames and the session stays usable", async () => {
    const logged = spyConsoleError();
    const session = client.tts.session({ websocketBaseUrl });
    const received: string[] = [];
    const thrown = new Error("bug in my player");
    session.on("audio", (e) => {
      received.push(Buffer.from(e.audio).toString());
      if (received.length === 1) throw thrown;
    });
    const errors: TextToSpeechError[] = [];
    session.on("error", (e) => errors.push(e));
    await connect(session);
    for (const text of ["One.", "Two.", "Three."]) {
      session.generate(text);
      session.flush();
    }
    await tick();
    expect(received).toEqual(["One.", "Two.", "Three."]);
    expect(logged.mock.calls).toEqual([
      ["TextToSpeechSession: the audio listener threw", thrown],
    ]);
    expect(errors).toEqual([]);
    expect(session.error).toBeUndefined();

    session.generate("Four.");
    session.flush();
    await tick();
    expect(received).toEqual(["One.", "Two.", "Three.", "Four."]);
    await expect(session.close()).resolves.toMatchObject({
      type: "Termination",
    });
  });

  it("every other listener that throws is logged and the session goes on", async () => {
    const logged = spyConsoleError();
    api.closeOnTerminate = false; // the close listener runs inside close()
    const session = client.tts.session({ websocketBaseUrl });
    const events = [
      "begin",
      "flushDone",
      "wordBoundaries",
      "cancelled",
      "termination",
      "close",
    ] as const;
    for (const event of events) {
      session.on(event as "begin", () => {
        throw new Error(`${event} listener failed`);
      });
    }
    await expect(connect(session)).resolves.toMatchObject({ id: "sess-1" });
    expect((await collect(session.speak("Hi."))).toString()).toBe("Hi.");
    api.sockets[0].send(
      JSON.stringify({
        type: "WordBoundaries",
        flush_id: 0,
        audio_start_ms: 0,
        words: [],
      }),
    );
    session.cancel();
    await tick();
    await expect(session.close()).resolves.toMatchObject({
      type: "Termination",
    });
    expect(session.error).toBeUndefined();
    expect(logged.mock.calls).toEqual(
      events.map((event) => [
        `TextToSpeechSession: the ${event} listener threw`,
        new Error(`${event} listener failed`),
      ]),
    );
  });

  it.each([
    {
      name: "audio that is not base64",
      frame: { type: "Audio", audio: "not base64!", flush_id: 0 },
    },
    {
      name: "an Audio frame without audio",
      frame: { type: "Audio", flush_id: 0 },
    },
    {
      name: "an Audio frame without a flush_id",
      frame: { type: "Audio", audio: "QQ==" },
    },
    {
      name: "a FlushDone without a flush_id",
      frame: { type: "FlushDone", audio_duration_ms: 80 },
    },
  ])("$name fails the session and closes the socket", async ({ frame }) => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    const errors: TextToSpeechError[] = [];
    const closes: [number, string][] = [];
    session.on("error", (e) => errors.push(e));
    session.on("close", (code, reason) => closes.push([code, reason]));
    await connect(session);
    const flushId = session.flush();
    const reading = outcome(collect(session.audio(flushId)));
    await tick();
    api.sockets[0].send(JSON.stringify(frame));
    const error = await reading;
    expect(error).toBeInstanceOf(TextToSpeechError);
    expect(error).toMatchObject({
      message: expect.stringMatching(/^Unreadable frame from the API: /),
      requestId: "sess-1",
    });
    expect(errors).toEqual([error]);
    await tick();
    expect(api.closes).toBe(1); // the client closed the socket
    expect(closes).toEqual([[1000, "Closed by the client"]]);
    expect(() => session.generate("late")).toThrow(error as Error);
    await expect(session.close()).resolves.toBeUndefined(); // already surfaced
    expect(closes).toHaveLength(1);
  });

  it("the error listener reconnects after an unreadable frame", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    let reconnecting: Promise<TtsBeginEvent> | undefined;
    session.on("error", () => {
      reconnecting = session.connect();
    });
    await connect(session);
    api.sockets[0].send(
      JSON.stringify({ type: "Audio", audio: "not base64!", flush_id: 0 }),
    );
    (await connection(2)).send(JSON.stringify(beginMessage));
    await expect(reconnecting).resolves.toMatchObject({ id: "sess-1" });
    expect((await collect(session.speak("Back."))).toString()).toBe("Back.");
    await session.close();
  });

  it("a JSON message that is not an object is ignored", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    for (const message of ["null", "42", '"Audio"', "[]", "not json"]) {
      api.sockets[0].send(message);
    }
    expect((await collect(session.speak("Still here."))).toString()).toBe(
      "Still here.",
    );
    await session.close();
  });

  it.each([
    {
      name: "an Error frame",
      refuse: (socket: ServerSocket) => {
        socket.send(errorFrame(3012, "voice_not_found", false));
        socket.close({ code: 3012, reason: "", wasClean: true });
      },
      closeCode: 3012,
    },
    {
      name: "a close",
      refuse: (socket: ServerSocket) =>
        socket.close({ code: 1008, reason: "Unauthorized", wasClean: true }),
      closeCode: 1008,
    },
  ])(
    "close() after connect() rejected with $name does not throw it again",
    async ({ refuse, closeCode }) => {
      const session = client.tts.session({ websocketBaseUrl });
      const connecting = session.connect();
      refuse(await connection(1));
      let caught: unknown;
      let closing: Promise<unknown> | undefined;
      try {
        await connecting;
      } catch (error) {
        caught = error;
      } finally {
        closing = session.close();
      }
      expect(caught).toMatchObject({ closeCode });
      await expect(closing).resolves.toBeUndefined();
    },
  );

  it("close() reports the close of an Error frame whose close is still in flight", async () => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    const closes: [number, string][] = [];
    session.on("close", (code, reason) => closes.push([code, reason]));
    await connect(session);
    const flushId = session.flush();
    api.sockets[0].send(errorFrame(3005, "at_capacity", true));
    api.sockets[0].close({ code: 3005, reason: "", wasClean: true });
    await expect(collect(session.audio(flushId))).rejects.toMatchObject({
      closeCode: 3005,
    });
    await session.close();
    expect(session.error?.closeCode).toBe(3005);
    expect(closes).toEqual([[3005, "See Error message for details"]]);
  });

  it("close() after Termination reports the session's end", async () => {
    api.closeOnTerminate = false; // the server's close is still in flight
    const session = client.tts.session({ websocketBaseUrl });
    const closes: [number, string][] = [];
    session.on("close", (code, reason) => closes.push([code, reason]));
    await connect(session);
    await session.close();
    expect(closes).toEqual([[1000, "Session ended"]]);
  });

  it("two close() calls at once send one Terminate and both resolve at Termination", async () => {
    api.answerTerminate = false;
    const session = client.tts.session({ websocketBaseUrl });
    const closes: [number, string][] = [];
    session.on("close", (code, reason) => closes.push([code, reason]));
    await connect(session);
    const hangUp = session.close(); // e.g. a hang-up handler
    const cleanUp = session.close(); // and a finally
    await tick();
    expect(api.frames("Terminate")).toHaveLength(1);
    expect(await outcome(hangUp, 20)).toBe("pending");

    api.sockets[0].send(JSON.stringify(terminationMessage));
    api.sockets[0].close({
      code: 1000,
      reason: "Session ended",
      wasClean: true,
    });
    const started = Date.now();
    expect(await outcome(hangUp)).toEqual(terminationMessage);
    expect(await outcome(cleanUp)).toEqual(terminationMessage);
    expect(Date.now() - started).toBeLessThan(250); // not the terminate timeout
    await expect(session.close()).resolves.toEqual(terminationMessage);
    expect(api.frames("Terminate")).toHaveLength(1);
    expect(closes).toEqual([[1000, "Session ended"]]);
  });

  it("only the first of two close() calls throws an unobserved error", async () => {
    api.answerTerminate = false;
    const session = client.tts.session({ websocketBaseUrl });
    session.on("audio", () => undefined); // push mode: nothing reads the error
    await connect(session);
    const first = outcome(session.close());
    const second = outcome(session.close());
    await tick();
    api.sockets[0].send(errorFrame(3005, "at_capacity", true));
    expect(await first).toMatchObject({ errorCode: "at_capacity" });
    expect(await second).toBeUndefined();
    expect(api.frames("Terminate")).toHaveLength(1);
  });

  it("close() keeps waiting while the API sends audio past terminateTimeout", async () => {
    api.answerFlush = false;
    api.answerTerminate = false;
    const session = client.tts.session({
      websocketBaseUrl,
      terminateTimeout: 150,
    });
    await connect(session);
    session.generate("Pending text.");
    const flushId = session.flush();
    const reading = outcome(collect(session.audio(flushId)), 2000);
    const started = Date.now();
    const closing = outcome(session.close(), 2000);
    await tick();
    // 450 ms of drain, a frame every 50 ms: longer than terminateTimeout,
    // never that long without a frame.
    for (let i = 0; i < 9; i++) {
      api.sockets[0].send(
        JSON.stringify({ type: "Audio", audio: "QQ==", flush_id: flushId }),
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    api.sockets[0].send(
      JSON.stringify({ type: "FlushDone", flush_id: flushId }),
    );
    api.sockets[0].send(JSON.stringify(terminationMessage));
    expect(await closing).toEqual(terminationMessage);
    expect(Date.now() - started).toBeGreaterThanOrEqual(450);
    expect(await reading).toEqual(Buffer.from("A".repeat(9)));
    expect(session.error).toBeUndefined();
  });

  it("a silent drain stops after terminateTimeout and the waiting reader rejects", async () => {
    api.answerFlush = false;
    api.answerTerminate = false;
    const session = client.tts.session({
      websocketBaseUrl,
      terminateTimeout: 100,
    });
    const closes: [number, string][] = [];
    session.on("close", (code, reason) => closes.push([code, reason]));
    await connect(session);
    session.generate("Never spoken.");
    const flushId = session.flush();
    const reading = outcome(collect(session.audio(flushId)), 1000);
    await tick();
    const started = Date.now();
    await expect(outcome(session.close(), 1000)).resolves.toBeUndefined();
    expect(Date.now() - started).toBeGreaterThanOrEqual(90);
    const error = await reading;
    expect(error).toBeInstanceOf(TextToSpeechError);
    expect(error).toMatchObject({
      message:
        "No Termination within the terminate timeout; the remaining audio was dropped",
      retryable: true,
      requestId: "sess-1",
    });
    expect(session.error).toBeUndefined(); // close() reports no failure
    expect(closes).toEqual([[1000, "Closed by the client"]]);
    await tick();
    expect(api.closes).toBe(1); // the client closed the socket
    await expect(session.close()).resolves.toBeUndefined();
  });

  it("close() does not end a connection a listener opened while it waited", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    let reconnecting: Promise<TtsBeginEvent> | undefined;
    session.on("termination", () => {
      reconnecting ??= session.connect();
    });
    await connect(session);
    const closing = outcome(session.close());
    (await connection(2)).send(JSON.stringify(beginMessage));
    expect(await closing).toEqual(terminationMessage);
    await expect(reconnecting).resolves.toMatchObject({ id: "sess-1" });
    expect((await collect(session.speak("Still open."))).toString()).toBe(
      "Still open.",
    );
    await expect(session.close()).resolves.toEqual(terminationMessage);
    expect(api.frames("Terminate")).toHaveLength(2);
  });

  it("sends after close() sent Terminate throw, and the drain still reaches its reader", async () => {
    // Given a session whose close() waits for the API to speak pending text
    api.answerTerminate = false;
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    session.generate("Pending text.");
    const reading = outcome(collect(session.audio()), 1000); // Terminate flushes it
    const closing = outcome(session.close(), 1000);

    // When the app goes on sending, as an LLM token loop still running would
    const closed = "The session is closing: close() was called";

    // Then text, flushes and cancels throw instead of being dropped unread,
    // a keepalive does nothing, and the API sees nothing after Terminate
    expect(() => session.generate("Too late.")).toThrow(closed);
    expect(() => session.flush()).toThrow(closed);
    expect(() => session.cancel()).toThrow(closed);
    expect(() => session.keepAlive()).not.toThrow();
    await tick();
    expect(api.sent.map((frame) => frame.type)).toEqual([
      "Generate",
      "Terminate",
    ]);

    // And the refused cancel did not end the reader of the drained request
    for (const audio of ["Pending ", "text."]) {
      api.sockets[0].send(
        JSON.stringify({
          type: "Audio",
          audio: Buffer.from(audio).toString("base64"),
          flush_id: 0,
        }),
      );
      await tick();
    }
    api.sockets[0].send(JSON.stringify({ type: "FlushDone", flush_id: 0 }));
    api.sockets[0].send(JSON.stringify(terminationMessage));
    expect(await closing).toEqual(terminationMessage);
    expect(await reading).toEqual(Buffer.from("Pending text."));

    // And once the session ended, a send says to connect again
    expect(() => session.generate("Later.")).toThrow(/call connect\(\) first/);
  });

  it("a send while the socket closes without an Error frame throws a retryable error", async () => {
    // Given a connection whose close frame (1011, no Error frame) arrived
    // and whose close event has not run yet, as with ws between the two
    const session = client.tts.session({ websocketBaseUrl });
    const errors: TextToSpeechError[] = [];
    session.on("error", (error) => errors.push(error));
    await connect(session);
    const socket = (session as unknown as { socket: { readyState: number } })
      .socket;
    socket.readyState = 2; // CLOSING

    // When the app sends
    const sends = [
      () => session.generate("Hello."),
      () => session.flush(),
      () => session.cancel(),
      () => session.keepAlive(),
    ];

    // Then each send throws a retryable TextToSpeechError with the session id
    for (const send of sends) {
      let thrown: unknown;
      try {
        send();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(TextToSpeechError);
      expect(thrown).toMatchObject({
        message: "The connection is closing",
        retryable: true,
        requestId: "sess-1",
      });
    }

    // And the close event that follows reports the close itself
    api.sockets[0].close({
      code: 1011,
      reason: "keepalive ping timeout",
      wasClean: false,
    });
    await tick();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ closeCode: 1011, retryable: true });
    expect(() => session.generate("Hello.")).toThrow(errors[0]);
  });

  it("connect() reports the previous connection's close before opening a new one", async () => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    const events: string[] = [];
    session.on("close", (code) => events.push(`close ${code}`));
    session.on("begin", () => events.push("begin"));
    await connect(session);
    const flushId = session.flush();
    api.sockets[0].send(errorFrame(3005, "at_capacity", true)); // no close yet
    await expect(collect(session.audio(flushId))).rejects.toMatchObject({
      closeCode: 3005,
    });
    const reconnecting = session.connect();
    (await connection(2)).send(JSON.stringify(beginMessage));
    await reconnecting;
    expect(events).toEqual(["begin", "close 3005", "begin"]);
    await session.close();
  });

  it("a connect timeout ends a reader waiting for the session", async () => {
    const session = client.tts.session({
      websocketBaseUrl,
      connectTimeout: 50,
    });
    const closes: [number, string][] = [];
    session.on("close", (code, reason) => closes.push([code, reason]));
    const connecting = outcome(session.connect());
    await connection(1); // no Begin follows
    const reading = outcome(collect(session.audio()));
    const error = await reading;
    expect(error).toBeInstanceOf(TextToSpeechError);
    expect(error).toMatchObject({
      retryable: true,
      message: expect.stringMatching(/did not begin within 50ms/),
    });
    expect(await connecting).toBe(error);
    expect(closes).toEqual([[1000, "Closed by the client"]]);
    await expect(outcome(session.close())).resolves.toBeUndefined();
    expect(closes).toHaveLength(1);
  });

  it("audio() before connect() says what to do", () => {
    const session = client.tts.session({ websocketBaseUrl });
    expect(() => session.audio()).toThrow(/call connect\(\) first/);
  });

  it("audio() takes its request when called, not at the first next()", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    const stream = session.audio(); // e.g. handed to a player that starts later
    session.generate("Made before the text.");
    expect(session.flush()).toBe(0);
    await tick(); // the request's audio and FlushDone are queued
    expect(await outcome(collect(stream))).toEqual(
      Buffer.from("Made before the text."),
    );
    expect((await collect(session.speak("Next."))).toString()).toBe("Next.");
    await session.close();
  });

  it("audio() refuses a request not flushed yet when called", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    expect(() => session.audio(99)).toThrow(RangeError);
    expect(() => session.audio(99)).toThrow(/flush_id 99 has not been flushed/);
    expect(() => session.audio(1)).toThrow(RangeError); // 0 is being written
    await session.close();
  });

  it("audio() refuses a request already read instead of waiting for the session to end", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    expect((await collect(session.speak("Read me once."))).toString()).toBe(
      "Read me once.",
    );
    expect(() => session.audio(0)).toThrow(RangeError);
    expect(() => session.audio(0)).toThrow(/flush_id 0 was already read/);

    // Reading a later request skips the FlushDone of an earlier one.
    session.generate("Skipped.");
    const skipped = session.flush();
    const early = session.audio(skipped); // made before the skip
    session.generate("Read.");
    expect((await collect(session.audio(session.flush()))).toString()).toBe(
      "Read.",
    );
    expect(() => session.audio(skipped)).toThrow(/already read/);
    await expect(early.next()).rejects.toThrow(/already read/);
    await session.close();
  });

  it("a pipelined request whose FlushDone is queued stays readable", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    session.generate("One. ");
    const first = session.flush();
    session.generate("Two.");
    const second = session.flush();
    await tick(); // both FlushDones are queued, neither read
    const readSecond = session.audio(second); // made before the first is read
    expect((await collect(session.audio(first))).toString()).toBe("One. ");
    expect((await collect(readSecond)).toString()).toBe("Two.");
    await session.close();
  });

  it("an iterator that is never iterated does not block the next reader", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    session.audio(); // dropped without a next()
    expect((await collect(session.speak("Hi."))).toString()).toBe("Hi.");
    await session.close();
  });

  it("an audio listener registered while a reader waits still lets it end at FlushDone", async () => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    const flushId = session.flush();
    const reading = outcome(collect(session.audio(flushId)));
    await tick();
    const received: Uint8Array[] = [];
    session.on("audio", (e) => received.push(e.audio));
    api.sockets[0].send(
      JSON.stringify({ type: "Audio", audio: "QQ==", flush_id: flushId }),
    );
    api.sockets[0].send(
      JSON.stringify({ type: "FlushDone", flush_id: flushId }),
    );
    expect(await reading).toEqual(Buffer.alloc(0)); // the audio went to the listener
    expect(received.map((a) => Buffer.from(a).toString())).toEqual(["A"]);
    await session.close();
  });

  it("an audio listener registered while a reader waits still lets close() end it", async () => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    await connect(session);
    const reading = outcome(collect(session.audio(session.flush())));
    await tick();
    session.on("audio", () => undefined);
    await session.close();
    expect(await reading).toEqual(Buffer.alloc(0));
  });

  it("an audio listener with no reader queues nothing", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    session.on("audio", () => undefined);
    await connect(session);
    for (const text of ["One.", "Two.", "Three."]) {
      session.generate(text);
      session.flush();
    }
    session.cancel();
    await tick();
    const queue = (session as unknown as { queue: { size: number } }).queue;
    expect(queue.size).toBe(0);
    await session.close();
    expect(queue.size).toBe(0);
  });

  describe("cancel() and audio still in transit", () => {
    const audioFrame = (text: string, flushId: number) =>
      JSON.stringify({
        type: "Audio",
        audio: Buffer.from(text).toString("base64"),
        flush_id: flushId,
      });
    const cancelledFrame = JSON.stringify({
      type: "Cancelled",
      audio_duration_seconds: 0.4,
    });
    const textOf = (chunk: IteratorResult<Uint8Array, void>) =>
      Buffer.from(chunk.value as Uint8Array).toString();

    beforeEach(() => {
      // The test sends the Cancelled, after the audio the API had already sent.
      api.answerCancel = false;
    });

    it("cancel() returns the id it takes, and the next flush() the one after", async () => {
      const session = client.tts.session({ websocketBaseUrl });
      await connect(session);
      expect(session.cancel()).toBe(0);
      expect(session.flush()).toBe(1);
      expect(session.cancel()).toBe(2);
      await session.close();
    });

    it("an audio listener gets no audio of a cancelled request still in transit", async () => {
      // Given an audio listener playing the request being written
      const session = client.tts.session({ websocketBaseUrl });
      const heard: string[] = [];
      session.on("audio", (event) =>
        heard.push(`${event.flush_id}:${Buffer.from(event.audio).toString()}`),
      );
      const cancelled = jest.fn();
      session.on("cancelled", cancelled);
      await connect(session);
      session.generate("A reply the user talks over. ");
      server.send(audioFrame("first", 0));
      expect(heard).toEqual(["0:first"]);

      // When the user barges in, and audio the API sent before it read the
      // Cancel arrives ahead of Cancelled
      expect(session.cancel()).toBe(0);
      for (let i = 0; i < 5; i++) server.send(audioFrame("stale", 0));
      server.send(cancelledFrame);
      await tick();

      // Then none of it reaches the listener
      expect(cancelled).toHaveBeenCalledTimes(1);
      expect(heard).toEqual(["0:first"]);

      // And the next request, which takes the id after the cancel, does
      session.generate("Sure, go ahead.");
      expect(session.flush()).toBe(1);
      await tick();
      expect(heard).toEqual(["0:first", "1:Sure, go ahead."]);
      await session.close();
    });

    it("a reader waiting when cancel() is called ends at once and yields nothing in transit", async () => {
      // Given a reader of request 0 waiting for its next frame
      api.answerFlush = false;
      const session = client.tts.session({ websocketBaseUrl });
      await connect(session);
      session.generate("A reply the user talks over. ");
      const reader = session.audio(session.flush());
      server.send(audioFrame("first", 0));
      expect(textOf(await reader.next())).toBe("first");
      const waiting = reader.next();
      await tick();

      // When the user barges in
      expect(session.cancel()).toBe(1);

      // Then the reader ends without waiting for Cancelled
      expect(await outcome(waiting, 100)).toEqual({
        value: undefined,
        done: true,
      });

      // And the audio still in transit is dropped, not queued: only the
      // Cancelled marker is
      for (let i = 0; i < 5; i++) server.send(audioFrame("stale", 0));
      server.send(cancelledFrame);
      await tick();
      const queue = (session as unknown as { queue: { size: number } }).queue;
      expect(queue.size).toBe(1);

      // And the next request reads only its own audio
      api.answerFlush = true;
      expect((await collect(session.speak("Next."))).toString()).toBe("Next.");
      await session.close();
    });

    it("a reader yields no frame that reached it just before cancel()", async () => {
      // Given a reader of the text being written, waiting for its first frame
      const session = client.tts.session({ websocketBaseUrl });
      await connect(session);
      const reader = session.audio();
      session.generate("A reply the user talks over. ");
      const waiting = reader.next();
      await tick();

      // When a frame is handed to it and the app cancels before the reader
      // runs again
      server.send(audioFrame("stale", 0));
      expect(session.cancel()).toBe(0);

      // Then the reader ends instead of yielding the frame
      expect(await outcome(waiting, 100)).toEqual({
        value: undefined,
        done: true,
      });
      server.send(cancelledFrame);
      await session.close();
    });
  });

  describe("connect() failures before the socket opens", () => {
    type FakeSocket = {
      OPEN: number;
      readyState: number;
      binaryType: string;
      onopen: (() => void) | null;
      onerror: ((event: unknown) => void) | null;
      onclose: ((event: unknown) => void) | null;
      onmessage: ((event: unknown) => void) | null;
      send: jest.Mock;
      close: jest.Mock;
    };

    /** Hands the session a socket the test drives, as the runtime would. */
    function fakeSocket(): FakeSocket {
      const socket: FakeSocket = {
        OPEN: 1,
        readyState: 0,
        binaryType: "blob",
        onopen: null,
        onerror: null,
        onclose: null,
        onmessage: null,
        send: jest.fn(),
        close: jest.fn(),
      };
      jest
        .spyOn(websocketPolyfill, "factory")
        .mockReturnValueOnce(
          socket as unknown as ReturnType<typeof websocketPolyfill.factory>,
        );
      return socket;
    }

    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    it.each([
      [404, false],
      [400, false],
      [401, false],
      [403, false],
      [408, true],
      [429, true],
      [502, true],
      [503, true],
    ])(
      "an upgrade answered %i carries the status and retryable %s",
      async (status, retryable) => {
        // Given a session whose upgrade the server answers with an HTTP status
        const socket = fakeSocket();
        const session = client.tts.session({ websocketBaseUrl });
        const connecting = session.connect();

        // When ws reports the refused upgrade
        const message = `Unexpected server response: ${status}`;
        socket.onerror?.({ error: new Error(message), message });

        // Then connect() rejects with the status, retryable only when transient
        const error = await connecting.catch((e: unknown) => e);
        expect(error).toBeInstanceOf(TextToSpeechError);
        expect(error).toMatchObject({
          message: `WebSocket handshake failed: ${message}`,
          status,
          retryable,
        });
        expect(session.error).toBe(error);
      },
    );

    it("a handshake error event without a message says what may have happened", async () => {
      // Given a browser, whose error event has neither error nor message
      const socket = fakeSocket();
      const session = client.tts.session({ websocketBaseUrl });
      const connecting = session.connect();

      // When the socket fails before it opens
      socket.onerror?.({ type: "error" });

      // Then the error explains it and stays retryable, with no status
      const error = await connecting.catch((e: unknown) => e);
      expect(error).toMatchObject({
        message:
          "WebSocket handshake failed: network error or the server refused the upgrade",
        status: undefined,
        retryable: true,
      });
    });

    it("a session needs an API key or a temporary token", () => {
      expect(() => new TextToSpeechSession({ websocketBaseUrl })).toThrow(
        "API key or temporary token is required.",
      );
      expect(
        () =>
          new TextToSpeechSession({ websocketBaseUrl, apiKey: "", token: "" }),
      ).toThrow("API key or temporary token is required.");
      expect(
        () => new TextToSpeechSession({ websocketBaseUrl, token: "tmp-1" }),
      ).not.toThrow();
      // The client fills in its own key.
      expect(() => client.tts.session({ websocketBaseUrl })).not.toThrow();
    });

    it("a socket the runtime refuses to create rejects connect() and leaves no timer", async () => {
      // Given a runtime whose WebSocket constructor throws, as a browser's
      // does for options it cannot take
      jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask"] });
      jest.spyOn(websocketPolyfill, "factory").mockImplementationOnce(() => {
        throw new SyntaxError("An invalid or illegal string was specified");
      });
      const session = client.tts.session({
        websocketBaseUrl,
        connectTimeout: 3000,
      });

      // When the session connects
      const error = await session.connect().catch((e: unknown) => e);

      // Then connect() rejects with a TextToSpeechError and no timer is left
      expect(error).toBeInstanceOf(TextToSpeechError);
      expect(error).toMatchObject({
        message:
          "Could not open the WebSocket: An invalid or illegal string was specified",
        retryable: false,
      });
      expect(jest.getTimerCount()).toBe(0);
      jest.useRealTimers();

      // And the session sends nothing, closes quietly and can connect again
      expect(() => session.keepAlive()).toThrow(error as TextToSpeechError);
      await expect(session.close()).resolves.toBeUndefined();
      await connect(session);
      expect((await collect(session.speak("Again."))).toString()).toBe(
        "Again.",
      );
      await session.close();
    });

    it.each(["https://localhost:1234/v1/ws", "not a url"])(
      "connect() with base URL %p rejects and leaves the previous connection as it was",
      async (badUrl) => {
        // Given a session whose last connection failed and whose close is
        // still to be reported
        api.answerFlush = false;
        const params = { websocketBaseUrl, apiKey: defaultApiKey };
        const session = new TextToSpeechSession(params);
        const events: string[] = [];
        session.on("close", (code) => events.push(`close ${code}`));
        await connect(session);
        const flushId = session.flush();
        api.sockets[0].send(errorFrame(3005, "at_capacity", true)); // no close yet
        await expect(collect(session.audio(flushId))).rejects.toMatchObject({
          closeCode: 3005,
        });
        const failed = session.error;

        // When it connects to a base URL that is not ws:// or wss://
        params.websocketBaseUrl = badUrl;
        let connecting: Promise<TtsBeginEvent> | undefined;
        expect(() => {
          connecting = session.connect();
        }).not.toThrow();

        // Then connect() rejects and nothing about the last connection changed
        await expect(connecting).rejects.toThrow();
        expect(session.error).toBe(failed);
        expect(session.begin?.id).toBe("sess-1");
        expect(events).toEqual([]);
        expect(api.sockets).toHaveLength(1);

        // And a valid URL connects again, reporting the last close first
        params.websocketBaseUrl = websocketBaseUrl;
        const reconnecting = session.connect();
        (await connection(2)).send(JSON.stringify(beginMessage));
        await reconnecting;
        expect(events).toEqual(["close 3005"]);
        await session.close();
      },
    );
  });
});
