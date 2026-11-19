jest.mock("ws", () => require("./mocks/ws"));

import WS from "jest-websocket-mock";
import { StreamingTranscriber } from "../../src";

const websocketBaseUrl = "wss://localhost:4243/v3/ws";
const terminate = JSON.stringify({ type: "Terminate" });

let server: WS;
let rt: StreamingTranscriber;
let onError: jest.Mock;
let active: Set<unknown>;
let setIntervalSpy: jest.SpyInstance;
let clearIntervalSpy: jest.SpyInstance;

function pcm(samples: number): ArrayBuffer {
  const buf = new Int16Array(samples);
  for (let i = 0; i < samples; i++) buf[i] = i % 2 === 0 ? 20_000 : -20_000;
  return buf.buffer;
}

// 800 samples = 50 ms at 16 kHz, the smallest chunk the mixer sends.
const send = (channel: string) => rt.sendAudio(pcm(800), { channel });

async function connect() {
  const p = rt.connect();
  await server.connected;
  server.send(JSON.stringify({ type: "Begin", id: "abc", expires_at: 1 }));
  await p;
}

describe("dual-channel sendAudio outside an open session", () => {
  beforeEach(() => {
    active = new Set();
    const realSetInterval = global.setInterval;
    const realClearInterval = global.clearInterval;
    setIntervalSpy = jest.spyOn(global, "setInterval").mockImplementation(((
      ...args: Parameters<typeof setInterval>
    ) => {
      const id = realSetInterval(...args);
      active.add(id);
      return id;
    }) as typeof setInterval);
    clearIntervalSpy = jest.spyOn(global, "clearInterval").mockImplementation(((
      id: Parameters<typeof clearInterval>[0],
    ) => {
      active.delete(id);
      realClearInterval(id);
    }) as typeof clearInterval);

    server = new WS(websocketBaseUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "t",
      sampleRate: 16_000,
      channels: [{ name: "mic" }, { name: "system" }],
      channelAttribution: { flushIntervalMs: 20 },
    });
    onError = jest.fn();
    rt.on("error", onError);
  });

  afterEach(() => {
    for (const id of active)
      clearInterval(id as ReturnType<typeof setInterval>);
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    WS.clean();
  });

  it("throws before connect() and starts no flush interval", () => {
    expect(() => send("mic")).toThrow("Socket is not open for communication");
    expect(active.size).toBe(0);
  });

  it("throws after close() and starts no flush interval", async () => {
    await connect();
    await rt.close(false);

    expect(() => send("mic")).toThrow("Socket is not open for communication");
    expect(() => send("system")).toThrow(
      "Socket is not open for communication",
    );
    expect(active.size).toBe(0);
  });

  it("throws after the server drops the connection", async () => {
    await connect();
    server.close({ code: 1006, reason: "", wasClean: false });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(() => send("mic")).toThrow("Socket is not open for communication");
    expect(() => send("system")).toThrow(
      "Socket is not open for communication",
    );
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(onError).not.toHaveBeenCalled();
    expect(active.size).toBe(0);
    await rt.close(false);
  });

  it("leaves no flush interval when audio arrives while close() waits", async () => {
    await connect();
    const closing = rt.close(true, 1000);
    await expect(server).toReceiveMessage(terminate);

    // The socket is still open while close() waits, so audio is accepted.
    send("mic");
    send("system");
    expect(active.size).toBe(1);

    server.send(JSON.stringify({ type: "Termination" }));
    await expect(closing).resolves.toEqual({ type: "Termination" });
    expect(active.size).toBe(0);
  });

  it("leaves no flush interval when only one channel sends while close() waits", async () => {
    await connect();
    const closing = rt.close(true, 1000);
    await expect(server).toReceiveMessage(terminate);

    send("mic");
    server.send(JSON.stringify({ type: "Termination" }));
    await closing;
    expect(active.size).toBe(0);
  });

  it("leaves no flush interval when close() gives up waiting", async () => {
    await connect();
    const closing = rt.close(true, 50);
    await expect(server).toReceiveMessage(terminate);

    send("mic");
    await expect(closing).resolves.toBeUndefined();
    expect(active.size).toBe(0);
  });

  it("still mixes and sends audio while the session is open", async () => {
    await connect();
    send("mic");
    send("system");
    const msg = (await server.nextMessage) as ArrayBuffer;
    expect(msg.byteLength).toBe(800 * 2);
    expect(active.size).toBe(1);

    const closing = rt.close();
    await expect(server).toReceiveMessage(terminate);
    server.send(JSON.stringify({ type: "Termination" }));
    await closing;
    expect(active.size).toBe(0);
  });
});
