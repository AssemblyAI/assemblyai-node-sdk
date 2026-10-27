import { createServer, Server } from "http";
import { AddressInfo, Socket } from "net";
import { TextToSpeechError, TextToSpeechSession } from "../../src";

/**
 * The real `ws` client against a server that answers the upgrade with an
 * HTTP status, so the status is read from the message `ws` actually writes.
 */
describe("tts session handshake refused with an HTTP status", () => {
  let server: Server;
  let sockets: Socket[];
  let status: number;

  beforeEach(async () => {
    sockets = [];
    server = createServer();
    server.on("upgrade", (_request, socket: Socket) => {
      socket.end(
        `HTTP/1.1 ${status} Refused\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`,
      );
    });
    server.on("connection", (socket) => sockets.push(socket));
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
  });

  afterEach(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });

  it.each([
    [404, false],
    [503, true],
  ])(
    "an upgrade answered %i sets the status and retryable %s",
    async (code, retryable) => {
      status = code;
      const { port } = server.address() as AddressInfo;
      const session = new TextToSpeechSession({
        websocketBaseUrl: `ws://127.0.0.1:${port}/v1/ws`,
        apiKey: "apikey_123",
      });

      const error = await session.connect().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(TextToSpeechError);
      expect(error).toMatchObject({
        message: `WebSocket handshake failed: Unexpected server response: ${code}`,
        status: code,
        retryable,
      });
      await expect(session.close()).resolves.toBeUndefined();
    },
  );
});
