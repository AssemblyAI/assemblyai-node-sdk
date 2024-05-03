import { createReadStream } from "fs";
import path from "path";
import "dotenv/config";
import {
  AssemblyAI,
  CreateRealtimeTranscriberParams,
  FinalTranscript,
  PartialTranscript,
} from "../../src";

const testDir = process.env["TESTDATA_DIR"] ?? "tests/static";
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

describe("realtime", () => {
  it("creates service with API key", (done) => transcribe(false, done), 20_000);

  it("creates service with token", (done) => transcribe(true, done), 20_000);

  it("can create a token", async () => {
    const token = await client.realtime.createTemporaryToken({
      expires_in: 480,
    });
    expect(token).toBeTruthy();
  });
});

function transcribe(useToken: boolean, done: jest.DoneCallback) {
  const partialTranscripts: PartialTranscript[] = [];
  const finalTranscripts: FinalTranscript[] = [];

  createRealtimeTranscriber(useToken)
    .then(async (realtimeTranscriber) => {
      realtimeTranscriber.on("open", ({ sessionId, expiresAt }) => {
        console.log("Session ID:", sessionId, "Expires At:", expiresAt);
      });
      realtimeTranscriber.on("close", (code: number, reason: string) => {
        console.log("Closed", code, reason);
      });
      realtimeTranscriber.on(
        "transcript.partial",
        (transcript: PartialTranscript) => {
          console.log("Transcript:", transcript);
          partialTranscripts.push(transcript);
        },
      );
      realtimeTranscriber.on(
        "transcript.final",
        (transcript: FinalTranscript) => {
          console.log("Transcript:", transcript);
          finalTranscripts.push(transcript);
        },
      );
      realtimeTranscriber.on("error", (error: Error) => {
        console.error(error);
        done(new Error(error.toString()));
      });

      await realtimeTranscriber.connect();

      const chunkSize = 16 * 1024;
      const audio = createReadStream(path.join(testDir, "gore-short.wav"), {
        highWaterMark: chunkSize,
      });
      let stop = false;
      setTimeout(() => realtimeTranscriber.forceEndUtterance(), 5_000);
      setTimeout(() => (stop = true), 10_000);
      for await (const chunk of audio) {
        if (stop) break;
        if (chunk.length < chunkSize) continue;
        realtimeTranscriber.sendAudio(chunk);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      console.log("File end");

      await realtimeTranscriber.close();

      expect(partialTranscripts.length).toBeGreaterThan(0);
      expect(finalTranscripts.length).toBeGreaterThan(0);

      done();
    })
    .catch(done);
}

async function createRealtimeTranscriber(useToken: boolean) {
  const serviceParams: CreateRealtimeTranscriberParams = {
    sampleRate: 16_000,
    wordBoost: ["gore", "climate"],
    token: useToken
      ? await client.realtime.createTemporaryToken({
          expires_in: 480,
        })
      : undefined,
    encoding: "pcm_s16le",
    endUtteranceSilenceThreshold: 500,
  };
  return client.realtime.transcriber(serviceParams);
}
