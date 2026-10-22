jest.mock("ws", () => require("./mocks/ws"));

import WS from "jest-websocket-mock";
import fetchMock from "jest-fetch-mock";
import { AssemblyAI, TextToSpeechError, TextToSpeechSession } from "../../src";
import { createClient } from "./utils";

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

/**
 * Plays the API: Generate/Flush answer with the text's bytes as one Audio
 * frame and a FlushDone, Cancel with Cancelled, Terminate with Termination
 * and a clean close.
 */
class FakeApi {
  text = "";
  flushId = 0;
  answerFlush = true;
  sent: Record<string, unknown>[] = [];

  constructor(public server: WS) {
    server.on("connection", (socket) => {
      this.text = ""; // a new connection is a new session: ids start at 0
      this.flushId = 0;
      socket.on("message", (raw) => {
        const frame = JSON.parse(String(raw)) as Record<string, unknown>;
        this.sent.push(frame);
        this.handle(frame, socket);
      });
    });
  }

  private handle(
    frame: Record<string, unknown>,
    socket: {
      send: (data: string) => void;
      close: (options?: {
        code: number;
        reason: string;
        wasClean: boolean;
      }) => void;
    },
  ) {
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
        socket.send(
          JSON.stringify({ type: "Cancelled", audio_duration_seconds: 0.1 }),
        );
        return;
      case "Terminate":
        socket.send(JSON.stringify(terminationMessage));
        socket.close({ code: 1000, reason: "Session ended", wasClean: true });
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

describe("tts session", () => {
  beforeEach(() => {
    server = new WS(websocketBaseUrl);
    api = new FakeApi(server);
    client = createClient();
  });
  afterEach(() => {
    WS.clean();
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

  it("a token goes in the query and the session can be reused", async () => {
    const session = client.tts.session({
      websocketBaseUrl,
      token: "tmp",
      inactivityTimeout: 30,
    });
    await connect(session);
    const url = new URL(
      (session as unknown as { socket: { url: string } }).socket.url,
    );
    expect(url.searchParams.get("token")).toBe("tmp");
    expect(url.searchParams.get("inactivity_timeout")).toBe("30");
    expect((await collect(session.speak("One."))).toString()).toBe("One.");
    await session.close();

    // same object, new connection: `server.connected` already resolved once,
    // so wait for the new socket before sending its Begin
    const reconnect = session.connect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    server.send(JSON.stringify(beginMessage));
    await reconnect;
    expect((await collect(session.speak("Two."))).toString()).toBe("Two.");
    await session.close();
  });

  it("a send before connect says what to do", () => {
    const session = client.tts.session({ websocketBaseUrl });
    expect(() => session.generate("Hi.")).toThrow(/connect\(\)/);
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
    expect(closes).toHaveLength(1);
    expect(closes[0][0]).toBe(1000);
  });
});
