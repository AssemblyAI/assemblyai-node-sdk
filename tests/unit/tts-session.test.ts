jest.mock("ws", () => require("./mocks/ws"));

import WS from "jest-websocket-mock";
import fetchMock from "jest-fetch-mock";
import {
  AssemblyAI,
  TextToSpeechError,
  TextToSpeechSession,
  TtsBeginEvent,
} from "../../src";
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

type ServerSocket = {
  send: (data: string) => void;
  close: (options?: {
    code: number;
    reason: string;
    wasClean: boolean;
  }) => void;
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
  closeOnTerminate = true;
  sent: Record<string, unknown>[] = [];
  /** The server side of each connection, in order. */
  sockets: ServerSocket[] = [];

  constructor(public server: WS) {
    server.on("connection", (socket) => {
      this.sockets.push(socket);
      this.text = ""; // a new connection is a new session: ids start at 0
      this.flushId = 0;
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
        socket.send(
          JSON.stringify({ type: "Cancelled", audio_duration_seconds: 0.1 }),
        );
        return;
      case "Terminate":
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
  return Promise.race([
    promise.catch((error: unknown) => error),
    new Promise<"pending">((resolve) =>
      setTimeout(() => resolve("pending"), ms),
    ),
  ]);
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

  it("a throwing error listener does not leave a reader waiting", async () => {
    api.answerFlush = false;
    const session = client.tts.session({ websocketBaseUrl });
    session.on("error", () => {
      throw new Error("listener failed");
    });
    await connect(session);
    const flushId = session.flush();
    const reading = outcome(collect(session.audio(flushId)));
    await tick();
    expect(() =>
      api.sockets[0].send(errorFrame(3005, "at_capacity", true)),
    ).toThrow("listener failed");
    expect(await reading).toMatchObject({ errorCode: "at_capacity" });
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

  it("audio() before connect() says what to do", async () => {
    const session = client.tts.session({ websocketBaseUrl });
    const first = outcome((async () => session.audio().next())());
    expect(await first).toMatchObject({
      message: expect.stringMatching(/call connect\(\) first/),
    });
  });
});
