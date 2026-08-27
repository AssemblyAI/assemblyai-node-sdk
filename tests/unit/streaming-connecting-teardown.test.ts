import { EventEmitter } from "events";
import { StreamingTranscriber, RealtimeTranscriber } from "../../src";

// Regression tests for
// https://github.com/AssemblyAI/assemblyai-node-sdk/issues/170.
//
// When a socket in the CONNECTING state is closed, `ws` aborts the handshake
// and emits `error` on the next tick. Node's EventEmitter turns an `error`
// emit with zero listeners into a thrown error — an uncaughtException that
// kills the process, since the emit happens outside any caller's try/catch.
// The SDK's teardown paths call `removeAllListeners()` before `close()`, so
// they must leave an error sink attached for that deferred emit to land on.
//
// The shared `tests/unit/mocks/ws.ts` mock can't catch this: its
// `removeAllListeners()` replaces handlers with no-ops instead of removing
// them, and mock-socket never does the deferred emit. This fake reproduces
// the relevant `ws` semantics: EventEmitter-backed listeners and an
// `onerror` attribute that registers a real listener.
class FakeConnectingWsSocket extends EventEmitter {
  CONNECTING = 0 as const;
  OPEN = 1 as const;
  CLOSING = 2 as const;
  CLOSED = 3 as const;
  readyState = 0;
  binaryType = "arraybuffer";
  closeCalled = false;

  private errorAttributeHandler: ((event: unknown) => void) | null = null;

  set onerror(handler: ((event: unknown) => void) | null) {
    if (this.errorAttributeHandler) {
      this.removeListener("error", this.errorAttributeHandler);
    }
    this.errorAttributeHandler = handler;
    if (handler) this.on("error", handler);
  }

  get onerror(): ((event: unknown) => void) | null {
    return this.errorAttributeHandler;
  }

  send(): void {}

  close(): void {
    this.closeCalled = true;
  }

  // ws's deferred `emitErrorAndClose`, run synchronously so a missing
  // listener fails this test instead of crashing the jest worker.
  emitDeferredHandshakeAbort(): void {
    this.emit(
      "error",
      new Error("WebSocket was closed before the connection was established"),
    );
  }
}

function injectSocket(
  transcriber: StreamingTranscriber | RealtimeTranscriber,
  socket: FakeConnectingWsSocket,
): void {
  (transcriber as unknown as { socket: unknown }).socket = socket;
}

describe("tearing down a CONNECTING socket", () => {
  it("discardPendingSocket() leaves an error sink attached", () => {
    const rt = new StreamingTranscriber({
      apiKey: "123",
      sampleRate: 16_000,
    });
    const socket = new FakeConnectingWsSocket();
    injectSocket(rt, socket);

    (rt as unknown as { discardPendingSocket(): void }).discardPendingSocket();

    expect(socket.closeCalled).toBe(true);
    expect(socket.listenerCount("error")).toBeGreaterThan(0);
    expect(() => socket.emitDeferredHandshakeAbort()).not.toThrow();
  });

  it("StreamingTranscriber.close() leaves an error sink attached", async () => {
    const rt = new StreamingTranscriber({
      apiKey: "123",
      sampleRate: 16_000,
    });
    const socket = new FakeConnectingWsSocket();
    injectSocket(rt, socket);

    // close() racing an unresolved connect(): the socket is not OPEN, so the
    // Termination handshake is skipped and teardown runs immediately.
    await rt.close();

    expect(socket.closeCalled).toBe(true);
    expect(socket.listenerCount("error")).toBeGreaterThan(0);
    expect(() => socket.emitDeferredHandshakeAbort()).not.toThrow();
  });

  it("RealtimeTranscriber.close() leaves an error sink attached", async () => {
    const rt = new RealtimeTranscriber({
      apiKey: "123",
      sampleRate: 16_000,
    });
    const socket = new FakeConnectingWsSocket();
    injectSocket(rt, socket);

    await rt.close();

    expect(socket.closeCalled).toBe(true);
    expect(socket.listenerCount("error")).toBeGreaterThan(0);
    expect(() => socket.emitDeferredHandshakeAbort()).not.toThrow();
  });
});
