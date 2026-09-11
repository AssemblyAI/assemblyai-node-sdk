import fetchMock from "jest-fetch-mock";
import { LanguageDetectionOptions } from "../../src";
import { createClient, requestMatches } from "./utils";

fetchMock.enableMocks();

const assembly = createClient();
const transcriptId = "transcript_123";
const remoteAudioURL = "https://assembly.ai/espn.m4a";

const invalidNoSpeechOptions: LanguageDetectionOptions = {
  // @ts-expect-error Only "error" and "fallback" are valid strategies.
  on_no_speech_detected: "ignore",
};
void invalidNoSpeechOptions;

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
      localization: ["en_au"],
      on_no_speech_detected: "fallback",
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

  it("should create transcript with on_low_language_confidence set to fallback", async () => {
    const languageDetectionOptions: LanguageDetectionOptions = {
      fallback_language: "en",
      on_low_language_confidence: "fallback",
    };

    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      language_detection: true,
      language_confidence_threshold: 0.8,
      language_detection_options: languageDetectionOptions,
    });

    expect(transcript.id).toBe(transcriptId);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.language_confidence_threshold).toBe(0.8);
    expect(requestBody.language_detection_options.fallback_language).toBe("en");
    expect(
      requestBody.language_detection_options.on_low_language_confidence,
    ).toBe("fallback");
  });

  it("should create transcript with on_low_language_confidence set to error", async () => {
    const languageDetectionOptions: LanguageDetectionOptions = {
      fallback_language: "en",
      on_low_language_confidence: "error",
    };

    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      language_detection: true,
      language_confidence_threshold: 0.7,
      language_detection_options: languageDetectionOptions,
    });

    expect(transcript.id).toBe(transcriptId);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.language_confidence_threshold).toBe(0.7);
    expect(requestBody.language_detection_options.fallback_language).toBe("en");
    expect(
      requestBody.language_detection_options.on_low_language_confidence,
    ).toBe("error");
  });

  it("should submit with on_no_speech_detected set to error", async () => {
    const languageDetectionOptions: LanguageDetectionOptions = {
      on_no_speech_detected: "error",
    };
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      language_detection: true,
      language_detection_options: languageDetectionOptions,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.language_detection_options).toEqual(
      languageDetectionOptions,
    );
  });

  it("should transcribe with no-speech fallback and preserve an empty result and warnings", async () => {
    const languageDetectionOptions: LanguageDetectionOptions = {
      on_no_speech_detected: "fallback",
      fallback_language: "en",
    };
    const completedResponse = {
      id: transcriptId,
      status: "completed",
      text: "",
      language_code: "en",
      metadata: {
        warnings: [{ message: "No speech was detected." }],
      },
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
      language_detection: true,
      language_detection_options: languageDetectionOptions,
    });

    expect(transcript).toEqual(completedResponse);
    expect(transcript.metadata?.warnings?.[0].message).toBe(
      "No speech was detected.",
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.language_detection_options).toEqual(
      languageDetectionOptions,
    );
  });
});
