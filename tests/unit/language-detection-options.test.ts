import fetchMock from "jest-fetch-mock";
import { LanguageDetectionOptions } from "../../src";
import { createClient, requestMatches } from "./utils";

fetchMock.enableMocks();

const assembly = createClient();
const transcriptId = "transcript_123";
const remoteAudioURL = "https://assembly.ai/espn.m4a";

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.resetMocks();
  fetchMock.doMock();
});

describe("language detection options", () => {
  it("should create transcript with all language_detection_options", async () => {
    const languageDetectionOptions: LanguageDetectionOptions = {
      expected_languages: ["en", "es"],
      fallback_language: "en",
      code_switching: true,
      code_switching_confidence_threshold: 0.8,
    };

    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      language_detection: true,
      language_detection_options: languageDetectionOptions,
    });

    expect(transcript.id).toBe(transcriptId);
    expect(transcript.status).toBe("queued");

    // Verify the request body included language_detection_options
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.language_detection).toBe(true);
    expect(requestBody.language_detection_options).toEqual(
      languageDetectionOptions,
    );
  });

  it("should create transcript with only code_switching enabled", async () => {
    const languageDetectionOptions: LanguageDetectionOptions = {
      code_switching: true,
    };

    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      language_detection: true,
      language_detection_options: languageDetectionOptions,
    });

    expect(transcript.id).toBe(transcriptId);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.language_detection_options.code_switching).toBe(true);
    expect(
      requestBody.language_detection_options
        .code_switching_confidence_threshold,
    ).toBeUndefined();
  });

  it("should create transcript with code_switching and confidence threshold", async () => {
    const languageDetectionOptions: LanguageDetectionOptions = {
      code_switching: true,
      code_switching_confidence_threshold: 0.75,
    };

    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      language_detection: true,
      language_detection_options: languageDetectionOptions,
    });

    expect(transcript.id).toBe(transcriptId);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.language_detection_options.code_switching).toBe(true);
    expect(
      requestBody.language_detection_options
        .code_switching_confidence_threshold,
    ).toBe(0.75);
  });

  it("should create transcript with only confidence threshold", async () => {
    const languageDetectionOptions: LanguageDetectionOptions = {
      code_switching_confidence_threshold: 0.9,
    };

    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      language_detection: true,
      language_detection_options: languageDetectionOptions,
    });

    expect(transcript.id).toBe(transcriptId);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(
      requestBody.language_detection_options.code_switching,
    ).toBeUndefined();
    expect(
      requestBody.language_detection_options
        .code_switching_confidence_threshold,
    ).toBe(0.9);
  });

  it("should handle null language_detection_options", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      language_detection: true,
      language_detection_options: null,
    });

    expect(transcript.id).toBe(transcriptId);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.language_detection_options).toBe(null);
  });
});
