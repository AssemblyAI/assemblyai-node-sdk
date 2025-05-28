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

  it("noop", async () => {});
});
