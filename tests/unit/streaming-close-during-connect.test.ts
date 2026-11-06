jest.mock("ws", () => require("./mocks/ws"));

import WS from "jest-websocket-mock";
import { StreamingTranscriber } from "../../src";

const websocketBaseUrl = "wss://localhost:1234/v3/ws";
const sessionBeginsMessage = {
  type: "Begin",
  id: "123",
  expires_at: 123456789,
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Counts connections and never answers with `Begin`, so `connect()` stays
// pending until the attempt times out.
function countConnections(server: WS, onConnection?: () => void) {
  const state = { count: 0 };
  const mockServer = (
    server as unknown as {
      server: { on: (event: "connection", cb: () => void) => void };
    }
  ).server;
  mockServer.on("connection", () => {
    state.count++;
    onConnection?.();
  });
  return state;
}

describe("streaming close() while connect() is pending", () => {
  let server: WS;

  beforeEach(() => {
    WS.clean();
    server = new WS(websocketBaseUrl);
  });

  afterEach(() => {
    WS.clean();
  });

  it("does not open a new connection after close()", async () => {
    const connections = countConnections(server);
    const rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      connectTimeout: 50,
      maxConnectionRetries: 2,
      connectionRetryDelay: 0,
    });

    const connectPromise = rt.connect();
    connectPromise.catch(() => {});
    await server.connected;
    expect(connections.count).toBe(1);

    await rt.close();
    // Longer than several connect timeouts: a retry would show up by now.
    await wait(300);

    expect(connections.count).toBe(1);
    await expect(connectPromise).rejects.toThrow(/closed/i);
  });

  it("does not open a new connection when close() runs during the retry delay", async () => {
    const connections = countConnections(server);
    const rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      connectTimeout: 30,
      maxConnectionRetries: 2,
      connectionRetryDelay: 200,
    });

    const connectPromise = rt.connect();
    connectPromise.catch(() => {});
    await server.connected;
    // The first attempt times out at ~30ms and the retry delay begins.
    await wait(80);
    await rt.close();
    await wait(400);

    expect(connections.count).toBe(1);
    await expect(connectPromise).rejects.toThrow(/closed/i);
  });

  it("can connect again after close()", async () => {
    const mockServer = (
      server as unknown as {
        server: {
          on: (
            event: "connection",
            cb: (socket: { send: (data: string) => void }) => void,
          ) => void;
        };
      }
    ).server;
    let connectionCount = 0;
    mockServer.on("connection", (socket) => {
      // Only the second connection gets a `Begin`.
      if (++connectionCount === 2) {
        socket.send(JSON.stringify(sessionBeginsMessage));
      }
    });
    const rt = new StreamingTranscriber({
      websocketBaseUrl,
      token: "123",
      sampleRate: 16_000,
      connectTimeout: 1000,
    });
    const first = rt.connect();
    first.catch(() => {});
    await server.connected;
    await rt.close();
    await expect(first).rejects.toThrow(/closed/i);

    await expect(rt.connect()).resolves.toMatchObject({ type: "Begin" });
    await rt.close(false);
  });
});
