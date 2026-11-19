jest.mock("ws", () => require("./mocks/ws"));

import WS from "jest-websocket-mock";
import { StreamingTranscriber } from "../../src";

const websocketBaseUrl = "wss://localhost:1234/v3/ws";
const termination = {
  type: "Termination",
  audio_duration_seconds: 12,
  session_duration_seconds: 14,
};
const terminate = JSON.stringify({ type: "Terminate" });

let server: WS;
let rt: StreamingTranscriber;
let onClose: jest.Mock;
let onTermination: jest.Mock;

/** Settles with the outcome, or "pending" when `p` has not settled by `ms`. */
function outcome(p: Promise<unknown>, ms = 300): Promise<unknown> {
  return Promise.race([
    p.then(
      (value) => ({ resolved: value }),
      (error: Error) => ({ rejected: error.message }),
    ),
    new Promise((resolve) => setTimeout(() => resolve("pending"), ms)),
  ]);
}

function terminateFramesReceived(): number {
  return server.messages.filter((m) => m === terminate).length;
}

function expectTornDown() {
  const state = rt as unknown as {
    socket?: unknown;
    listeners: Record<string, unknown>;
    sessionTerminatedResolve?: unknown;
  };
  expect(state.socket).toBeUndefined();
  expect(state.listeners).toEqual({});
  expect(state.sessionTerminatedResolve).toBeUndefined();
}

describe("concurrent StreamingTranscriber.close() calls", () => {
  beforeEach(async () => {
    server = new WS(websocketBaseUrl);
    rt = new StreamingTranscriber({
      websocketBaseUrl,
      apiKey: "123",
      sampleRate: 16_000,
    });
    onClose = jest.fn();
    onTermination = jest.fn();
    rt.on("close", onClose);
    rt.on("termination", onTermination);
    const connectPromise = rt.connect();
    await server.connected;
    server.send(JSON.stringify({ type: "Begin", id: "123", expires_at: 1 }));
    await connectPromise;
  });

  afterEach(() => {
    WS.clean();
  });

  it("resolves every waiting call with the one Termination frame", async () => {
    const first = rt.close(true, 0);
    const second = rt.close(true, 0);
    await expect(server).toReceiveMessage(terminate);
    server.send(JSON.stringify(termination));

    await expect(outcome(first)).resolves.toEqual({ resolved: termination });
    await expect(outcome(second)).resolves.toEqual({ resolved: termination });
    expect(terminateFramesReceived()).toBe(1);
    expect(onTermination).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(1000, "Session ended");
    expectTornDown();
  });

  it("does not reject the earlier call when a later call finishes first", async () => {
    const first = rt.close(true, 150);
    const second = rt.close(true, 500);
    await expect(server).toReceiveMessage(terminate);
    setTimeout(() => server.send(JSON.stringify(termination)), 50);

    await expect(outcome(first)).resolves.toEqual({ resolved: termination });
    await expect(outcome(second)).resolves.toEqual({ resolved: termination });
    expect(onClose).toHaveBeenCalledTimes(1);
    expectTornDown();
  });

  it("resolves every call with undefined when the server stays silent", async () => {
    const first = rt.close(true, 100);
    const second = rt.close(true, 100);

    await expect(outcome(first)).resolves.toEqual({ resolved: undefined });
    await expect(outcome(second)).resolves.toEqual({ resolved: undefined });
    expect(terminateFramesReceived()).toBe(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(1000, "Closed by the client");
    expectTornDown();
  });

  it("applies the first call's policy to a later close(false)", async () => {
    const first = rt.close(true, 0);
    const second = rt.close(false);
    await expect(server).toReceiveMessage(terminate);
    server.send(JSON.stringify(termination));

    await expect(outcome(first)).resolves.toEqual({ resolved: termination });
    await expect(outcome(second)).resolves.toEqual({ resolved: termination });
    expect(terminateFramesReceived()).toBe(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expectTornDown();
  });

  it("resolves two close(false) calls without waiting", async () => {
    const first = rt.close(false);
    const second = rt.close(false);

    await expect(outcome(first, 50)).resolves.toEqual({ resolved: undefined });
    await expect(outcome(second, 50)).resolves.toEqual({
      resolved: undefined,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expectTornDown();
  });

  it("starts a fresh close() once the earlier one has finished", async () => {
    const first = rt.close(true, 0);
    await expect(server).toReceiveMessage(terminate);
    server.send(JSON.stringify(termination));
    await expect(first).resolves.toEqual(termination);

    // Nothing left to close: a new call resolves at once, without the frame.
    await expect(outcome(rt.close(true, 0), 50)).resolves.toEqual({
      resolved: undefined,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
