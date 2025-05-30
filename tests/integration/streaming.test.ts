import { createReadStream } from "fs";
import path from "path";
import "dotenv/config";
import { AssemblyAI, StreamingTranscriberParams, TurnEvent } from "../../src";

const testDir = process.env["TESTDATA_DIR"] ?? "tests/static";
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
  streamingBaseUrl: process.env.ASSEMBLYAI_STREAMING_HTTP_API_HOST,
});

describe("streaming", () => {
  it("transcribe with API key", (done) => transcribe(false, done), 20_000);

  it("transcribe with token", (done) => transcribe(true, done), 20_000);

  it("can create a token", async () => {
    const token = await client.streaming.createTemporaryToken({
      expires_in_seconds: 480,
      max_session_duration_seconds: 480,
    });
    expect(token).toBeTruthy();
  });
});

function transcribe(useToken: boolean, done: jest.DoneCallback) {
  const turns: TurnEvent[] = [];
  const onOpen = jest.fn();
  const onClose = jest.fn();

  createStreamingTranscriber(useToken)
    .then(async (streamingTranscriber) => {
      streamingTranscriber.on("open", onOpen);
      streamingTranscriber.on("close", onClose);
      streamingTranscriber.on("turn", (event: TurnEvent) => {
        turns.push(event);
      });
      streamingTranscriber.on("error", (error: Error) => {
        console.error(error);
        done(new Error(error.toString()));
      });

      await streamingTranscriber.connect();

      const chunkSize = 16 * 1024;
      const audio = createReadStream(path.join(testDir, "gore-short.wav"), {
        highWaterMark: chunkSize,
      });
      let stop = false;
      setTimeout(() => (stop = true), 10_000);
      for await (const chunk of audio) {
        if (stop) break;
        if (chunk.length < chunkSize) continue;
        streamingTranscriber.sendAudio(chunk);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      await streamingTranscriber.close();

      expect(onOpen).toHaveBeenCalledWith({
        id: expect.any(String),
        expires_at: expect.any(Number),
        type: "Begin",
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(turns.length).toBeGreaterThan(0);
      done();
    })
    .catch(done);
}

async function createStreamingTranscriber(useToken: boolean) {
  const serviceParams: StreamingTranscriberParams = {
    websocketBaseUrl: process.env.ASSEMBLYAI_STREAMING_WS_API_HOST,
    sampleRate: 16_000,
    apiKey: useToken ? undefined : process.env.ASSEMBLYAI_API_KEY,
    token: useToken
      ? await client.streaming.createTemporaryToken({
          expires_in_seconds: 480,
          max_session_duration_seconds: 480,
        })
      : undefined,
  };
  return client.streaming.transcriber(serviceParams);
}
