import http from "http";
import { AddressInfo } from "net";
import { getEventListeners } from "events";
import { AssemblyAI, DictationError, SyncTranscriptError } from "../../src";

const okBody = JSON.stringify({
  text: "ok",
  words: [],
  confidence: 1,
  audio_duration_ms: 100,
  session_id: "s",
});

let server: http.Server;
let client: AssemblyAI;
/** How the next request is answered: 200, a rejection, or never. */
let answer: "ok" | "reject" | "hang" | "body" = "ok";

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (answer === "hang") return;
    if (answer === "reject") {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "bad key" }));
      req.resume();
      return;
    }
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      if (answer === "body") {
        res.write(okBody.slice(0, 10));
        server.emit("partial-response");
        return;
      }
      res.end(okBody);
    });
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  client = new AssemblyAI({
    apiKey: "key",
    syncBaseUrl: url,
    dictationBaseUrl: url,
  });
});

afterEach(() => {
  answer = "ok";
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const pcm = { sample_rate: 16000, channels: 1 };
const audio = () => new Uint8Array(320);
async function* chunks() {
  yield audio();
  yield audio();
}
const abortListeners = (signal: AbortSignal) =>
  getEventListeners(signal, "abort").length;

describe("a signal shared by many live requests", () => {
  it("holds no listener once each request has finished", async () => {
    const shared = new AbortController();
    const { signal } = shared;
    for (let i = 0; i < 5; i++) {
      await client.sync.transcribe(audio(), pcm, { signal });
      await client.sync.transcribeLive(chunks(), pcm, { signal });
      await client.dictation.transcribeLive(audio(), pcm, { signal });
      await client.dictation.transcribeLive(chunks(), pcm, { signal });
    }
    expect(abortListeners(signal)).toBe(0);
  });

  it("holds no listener once each request has been rejected", async () => {
    answer = "reject";
    const { signal } = new AbortController();
    for (let i = 0; i < 3; i++) {
      await expect(
        client.sync.transcribe(audio(), pcm, { signal }),
      ).rejects.toBeInstanceOf(SyncTranscriptError);
      await expect(
        client.dictation.transcribeLive(chunks(), pcm, { signal }),
      ).rejects.toBeInstanceOf(DictationError);
    }
    expect(abortListeners(signal)).toBe(0);
  });

  it("still cancels the request in flight when it aborts", async () => {
    answer = "hang";
    const shared = new AbortController();
    const pending = client.sync.transcribe(audio(), pcm, {
      signal: shared.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(abortListeners(shared.signal)).toBe(1);
    shared.abort(new Error("shutting down"));
    await expect(pending).rejects.toThrow("shutting down");
    expect(abortListeners(shared.signal)).toBe(0);
  });

  it("still applies the timeout alongside the signal", async () => {
    answer = "hang";
    const { signal } = new AbortController();
    await expect(
      client.dictation.transcribeLive(audio(), pcm, { signal, timeout: 50 }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(abortListeners(signal)).toBe(0);
  });

  it("leaves an openLive() session working with its own signal", async () => {
    const session = client.sync.openLive(pcm);
    session.write(audio());
    await expect(session.result()).resolves.toMatchObject({ text: "ok" });
  });

  it("releases only its own listener while another request still waits", async () => {
    answer = "hang";
    const shared = new AbortController();
    const requested = new Promise((resolve) => server.once("request", resolve));
    const pending = client.dictation.transcribeLive(audio(), pcm, {
      signal: shared.signal,
    });
    await requested;
    answer = "ok";
    try {
      await client.sync.transcribe(audio(), pcm, { signal: shared.signal });
      expect(abortListeners(shared.signal)).toBe(1);
    } finally {
      shared.abort(new Error("shutting down"));
      await expect(pending).rejects.toThrow("shutting down");
    }
    expect(abortListeners(shared.signal)).toBe(0);
  });

  it("keeps cancellation active while reading a partial response body", async () => {
    answer = "body";
    const shared = new AbortController();
    const responding = new Promise((resolve) =>
      server.once("partial-response", resolve),
    );
    const pending = client.sync.transcribe(audio(), pcm, {
      signal: shared.signal,
    });
    await responding;
    expect(abortListeners(shared.signal)).toBe(1);
    shared.abort();
    await expect(pending).rejects.toThrow();
    expect(abortListeners(shared.signal)).toBe(0);
  });
});
