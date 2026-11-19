import fetchMock from "jest-fetch-mock";
import { TranscriptParams } from "../../src";
import { createClient, requestMatches } from "./utils";

fetchMock.enableMocks();

const assembly = createClient();
const transcriptId = "transcript_123";
const remoteAudioURL = "https://assembly.ai/espn.m4a";

const invalidLanguageCodes: TranscriptParams = {
  audio_url: remoteAudioURL,
  // @ts-expect-error language_codes takes a list, not a single code.
  language_codes: "en",
};
void invalidLanguageCodes;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.resetMocks();
  fetchMock.doMock();
});

describe("language_codes", () => {
  it("should send language_codes on submit", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speech_models: ["assemblyai-stt-3-7"],
      language_codes: ["en", "es", "pt"],
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.speech_models).toEqual(["assemblyai-stt-3-7"]);
    expect(requestBody.language_codes).toEqual(["en", "es", "pt"]);
    expect(requestBody.language_code).toBeUndefined();
  });

  it("should send language_codes on transcribe and return the transcript", async () => {
    const completedResponse = {
      id: transcriptId,
      status: "completed",
      speech_model_used: "assemblyai-stt-3-7",
      language_codes: ["en", "es", "pt"],
      disfluencies: true,
    };
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );
    fetchMock.doMockOnceIf(
      requestMatches({ url: `/v2/transcript/${transcriptId}`, method: "GET" }),
      JSON.stringify(completedResponse),
    );

    const transcript = await assembly.transcripts.transcribe({
      audio: remoteAudioURL,
      speech_models: ["assemblyai-stt-3-7"],
      language_codes: ["en", "es", "pt"],
    });

    expect(transcript.language_codes).toEqual(["en", "es", "pt"]);
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.language_codes).toEqual(["en", "es", "pt"]);
  });
});
