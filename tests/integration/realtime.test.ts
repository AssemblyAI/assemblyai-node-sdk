import { createReadStream } from "fs";
import path from "path";
import "dotenv/config";
import {
  AssemblyAI,
  CreateRealtimeTranscriberParams,
  FinalTranscript,
  PartialTranscript,
  RealtimeTranscript,
} from "../../src";

const testDir = process.env["TESTDATA_DIR"] ?? "tests/static";
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

describe("realtime", () => {
  it("transcribe with API key", (done) => transcribe(false, done), 20_000);

  it("transcribe with token", (done) => transcribe(true, done), 20_000);

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
  const transcripts: RealtimeTranscript[] = [];
  const onOpen = jest.fn();
  const onClose = jest.fn();
  const onSessionInfo = jest.fn();

  createRealtimeTranscriber(useToken)
    .then(async (realtimeTranscriber) => {
      realtimeTranscriber.on("open", onOpen);
      realtimeTranscriber.on("close", onClose);
      realtimeTranscriber.on("session_information", onSessionInfo);
      realtimeTranscriber.on("transcript", (transcript: RealtimeTranscript) => {
        transcripts.push(transcript);
      });
      realtimeTranscriber.on(
        "transcript.partial",
        (transcript: PartialTranscript) => {
          partialTranscripts.push(transcript);
        },
      );
      realtimeTranscriber.on(
        "transcript.final",
        (transcript: FinalTranscript) => {
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

      await realtimeTranscriber.close();

      expect(onOpen).toHaveBeenCalledWith({
        sessionId: expect.any(String),
        expiresAt: expect.any(Date),
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(partialTranscripts.length).toBeGreaterThan(0);
      const partialTranscriptMatcher = {
        message_type: "PartialTranscript",
        audio_end: expect.any(Number),
        audio_start: expect.any(Number),
        confidence: expect.any(Number),
        created: expect.any(Date),
        text: expect.any(String),
        words: expect.any(Array),
      };
      expect(partialTranscripts).toMatchObject(
        new Array(partialTranscripts.length).fill(partialTranscriptMatcher),
      );
      expect(finalTranscripts.length).toBeGreaterThan(0);
      const finalTranscriptMatcher = {
        message_type: "FinalTranscript",
        audio_end: expect.any(Number),
        audio_start: expect.any(Number),
        confidence: expect.any(Number),
        created: expect.any(Date),
        text: expect.any(String),
        words: expect.any(Array),
      };
      expect(finalTranscripts).toMatchObject(
        new Array(finalTranscripts.length).fill(finalTranscriptMatcher),
      );
      expect(transcripts.length).toBeGreaterThan(0);
      const transcriptMatcher = {
        message_type: expect.stringMatching(
          /PartialTranscript|FinalTranscript/,
        ),
        audio_end: expect.any(Number),
        audio_start: expect.any(Number),
        confidence: expect.any(Number),
        created: expect.any(Date),
        text: expect.any(String),
        words: expect.any(Array),
      };
      expect(transcripts).toMatchObject(
        new Array(transcripts.length).fill(transcriptMatcher),
      );

      expect(onSessionInfo).toHaveBeenCalledWith({
        audio_duration_seconds: expect.any(Number),
        message_type: "SessionInformation",
      });

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
