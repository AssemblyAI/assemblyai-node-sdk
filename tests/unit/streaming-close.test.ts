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

let server: WS;
let aai: AssemblyAI;
let rt: StreamingTranscriber;

// These tests deliberately avoid the shared `close()` helper used elsewhere,
// which always sends a `Termination` frame. The point is what happens when the
// server never sends one.
describe("streaming close", () => {
  beforeEach(async () => {
    server = new WS(websocketBaseUrl);
    aai = createClient();
    rt = aai.streaming.transcriber({
      websocketBaseUrl: websocketBaseUrl,
      apiKey: "123",
      sampleRate: 16_000,
      speechModel: "universal-streaming-english",
    });
    const connectPromise = rt.connect();
    await server.connected;
    server.send(JSON.stringify(sessionBeginsMessage));
    await connectPromise;
  });

  afterEach(() => {
    WS.clean();
  });

  it("resolves when the server closes without a Termination frame", async () => {
    const closePromise = rt.close();
    // The server acknowledges the terminate by dropping the connection, which
    // is what a crashing or impatient server does.
    server.close({ code: 1000, reason: "", wasClean: true });

    await expect(closePromise).resolves.toBeUndefined();
  });

  it("resolves when the server goes silent, bounded by the timeout", async () => {
    const started = Date.now();
    // The server neither replies nor closes. Only the timeout can end this.
    await rt.close(true, 150);

    expect(Date.now() - started).toBeGreaterThanOrEqual(140);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("resolves as soon as the Termination frame arrives", async () => {
    const started = Date.now();
    const closePromise = rt.close(true, 10_000);
    server.send(JSON.stringify({ type: "Termination" }));
    await closePromise;

    // Well under the timeout, so the frame ended the wait rather than the timer.
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("does not wait when waitForSessionTermination is false", async () => {
    const started = Date.now();
    await rt.close(false);

    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("resolves when the socket is already dead", async () => {
    server.close({
      code: 4031,
      reason: "Session idle for too long",
      wasClean: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    await expect(rt.close()).resolves.toBeUndefined();
  });

  describe("termination and close events", () => {
    const termination = {
      type: "Termination",
      audio_duration_seconds: 12,
      session_duration_seconds: 14,
    };

    it("emits termination and resolves close() with the frame", async () => {
      const onTermination = jest.fn();
      const onClose = jest.fn();
      rt.on("termination", onTermination);
      rt.on("close", onClose);

      const closePromise = rt.close();
      await expect(server).toReceiveMessage(
        JSON.stringify({ type: "Terminate" }),
      );
      server.send(JSON.stringify(termination));

      await expect(closePromise).resolves.toEqual(termination);
      expect(onTermination).toHaveBeenCalledTimes(1);
      expect(onTermination).toHaveBeenCalledWith(termination);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith(1000, "Session ended");
      // The termination listener runs before close() resolves, and close
      // after it.
      expect(onTermination.mock.invocationCallOrder[0]).toBeLessThan(
        onClose.mock.invocationCallOrder[0],
      );
    });

    it("emits termination for a frame the server sends unprompted", async () => {
      const onTermination = jest.fn();
      rt.on("termination", onTermination);

      server.send(JSON.stringify(termination));
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(onTermination).toHaveBeenCalledWith(termination);
      await rt.close(false);
    });

    it("calls close once when close() does not wait", async () => {
      const onClose = jest.fn();
      rt.on("close", onClose);

      await expect(rt.close(false)).resolves.toBeUndefined();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith(1000, "Closed by the client");
    });

    it("calls close once and resolves undefined on timeout", async () => {
      const onClose = jest.fn();
      rt.on("close", onClose);

      await expect(rt.close(true, 50)).resolves.toBeUndefined();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith(1000, "Closed by the client");
    });

    it("calls close once with the server's code when the server closes first", async () => {
      const onClose = jest.fn();
      rt.on("close", onClose);

      const closePromise = rt.close();
      server.close({ code: 1000, reason: "bye", wasClean: true });

      await expect(closePromise).resolves.toBeUndefined();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith(1000, "bye");
    });

    it("does not call close again after a server-initiated close", async () => {
      const onClose = jest.fn();
      rt.on("close", onClose);

      server.close({ code: 4031, reason: "idle", wasClean: false });
      await new Promise((resolve) => setTimeout(resolve, 20));
      await rt.close();

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith(4031, "idle");
    });

    it("clears the listeners once closed", async () => {
      const onClose = jest.fn();
      rt.on("close", onClose);
      await rt.close(false);

      expect(
        (rt as unknown as { listeners: Record<string, unknown> }).listeners,
      ).toEqual({});
      // A second close() has no session to report.
      await rt.close(false);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call close for a session that never opened", async () => {
      const unopened = aai.streaming.transcriber({
        websocketBaseUrl,
        apiKey: "123",
        sampleRate: 16_000,
      });
      const onClose = jest.fn();
      unopened.on("close", onClose);

      await expect(unopened.close()).resolves.toBeUndefined();
      expect(onClose).not.toHaveBeenCalled();
      await rt.close(false);
    });
  });
});
