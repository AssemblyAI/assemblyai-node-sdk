jest.mock("ws", () => require("./mocks/ws"));

import WS from "jest-websocket-mock";
import { RealtimeTranscriber } from "../../src";

const realtimeUrl = "wss://localhost:1234";

describe("realtime close() while connect() is pending", () => {
  let server: WS;

  beforeEach(() => {
    WS.clean();
    server = new WS(realtimeUrl);
  });

  afterEach(() => {
    WS.clean();
  });

  it("rejects the pending connect() promise", async () => {
    const rt = new RealtimeTranscriber({
      realtimeUrl,
      token: "123",
      sampleRate: 16_000,
    });

    const outcome = rt.connect().then(
      () => "resolved",
      (error: Error) => error.message,
    );
    await server.connected;
    await rt.close(false);

    await expect(outcome).resolves.toMatch(/closed/i);
  });
});
