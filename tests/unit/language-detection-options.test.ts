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

  // These mocked responses verify transport, not server silence detection or defaults.
  describe.each(["submit", "transcribe"] as const)("%s", (method) => {
    it.each(["audio", "audio_url"] as const)(
      "should forward no-speech fallback using %s and preserve the API response",
      async (audioKey) => {
        const languageDetectionOptions: LanguageDetectionOptions = {
          on_no_speech_detected: "fallback",
          fallback_language: "en",
        };
        const queuedResponse = { id: transcriptId, status: "queued" };
        const completedResponse = {
          id: transcriptId,
          status: "completed",
          text: "",
          language_code: "en",
          metadata: {
            warnings: [
              {
                message:
                  "No speech was detected; using the configured fallback language.",
              },
            ],
          },
        };
        fetchMock.doMockOnceIf(
          requestMatches({ url: "/v2/transcript", method: "POST" }),
          JSON.stringify(queuedResponse),
        );
        if (method === "transcribe") {
          fetchMock.doMockOnceIf(
            requestMatches({
              url: `/v2/transcript/${transcriptId}`,
              method: "GET",
            }),
            JSON.stringify({ id: transcriptId, status: "processing" }),
          );
          fetchMock.doMockOnceIf(
            requestMatches({
              url: `/v2/transcript/${transcriptId}`,
              method: "GET",
            }),
            JSON.stringify(completedResponse),
          );
        }

        const params = {
          ...(audioKey === "audio"
            ? { audio: remoteAudioURL }
            : { audio_url: remoteAudioURL }),
          language_detection: true,
          language_detection_options: languageDetectionOptions,
        };
        const transcript =
          method === "transcribe"
            ? await assembly.transcripts.transcribe(params, {
                pollingInterval: 1,
                pollingTimeout: 500,
              })
            : await assembly.transcripts.submit(params);

        const requestBody = JSON.parse(
          fetchMock.mock.calls[0][1]?.body as string,
        );
        expect(requestBody).toEqual({
          audio_url: remoteAudioURL,
          language_detection: true,
          language_detection_options: languageDetectionOptions,
        });
        if (method === "transcribe") {
          expect(transcript).toEqual(completedResponse);
          expect(transcript.metadata?.warnings?.[0].message).toBe(
            completedResponse.metadata.warnings[0].message,
          );
          expect(fetchMock).toHaveBeenCalledTimes(3);
        } else {
          expect(transcript).toEqual(queuedResponse);
          expect(fetchMock).toHaveBeenCalledTimes(1);
        }
      },
    );

    it.each([undefined, "error"] as const)(
      "should preserve a terminal API error when on_no_speech_detected is %s",
      async (strategy) => {
        const languageDetectionOptions: LanguageDetectionOptions = {
          fallback_language: "en",
          ...(strategy === undefined
            ? {}
            : { on_no_speech_detected: strategy }),
        };
        const errorResponse = {
          id: transcriptId,
          status: "error",
          error:
            "language_detection cannot be performed on files with no spoken audio.",
        };
        fetchMock.doMockOnceIf(
          requestMatches({ url: "/v2/transcript", method: "POST" }),
          JSON.stringify(
            method === "transcribe"
              ? { id: transcriptId, status: "queued" }
              : errorResponse,
          ),
        );
        if (method === "transcribe") {
          fetchMock.doMockOnceIf(
            requestMatches({
              url: `/v2/transcript/${transcriptId}`,
              method: "GET",
            }),
            JSON.stringify(errorResponse),
          );
        }

        const transcript = await assembly.transcripts[method]({
          audio_url: remoteAudioURL,
          language_detection: true,
          language_detection_options: languageDetectionOptions,
        });

        expect(transcript).toEqual(errorResponse);
        const requestBody = JSON.parse(
          fetchMock.mock.calls[0][1]?.body as string,
        );
        expect(requestBody.language_detection_options).toEqual(
          languageDetectionOptions,
        );
        if (strategy === undefined) {
          expect(requestBody.language_detection_options).not.toHaveProperty(
            "on_no_speech_detected",
          );
        }
        expect(fetchMock).toHaveBeenCalledTimes(
          method === "transcribe" ? 2 : 1,
        );
      },
    );

    // Validation remains server-owned, including whether an omitted fallback is accepted.
    it.each([
      {
        fallbackLanguage: undefined,
        message:
          "fallback_language is required when on_no_speech_detected is fallback",
      },
      {
        fallbackLanguage: "auto",
        message: "fallback_language must be a specific language code, not auto",
      },
    ])(
      "should forward fallback_language=$fallbackLanguage and preserve a mocked API 400 error message",
      async ({ fallbackLanguage, message }) => {
        const languageDetectionOptions: LanguageDetectionOptions = {
          on_no_speech_detected: "fallback",
          ...(fallbackLanguage === undefined
            ? {}
            : { fallback_language: fallbackLanguage }),
        };
        fetchMock.doMockOnceIf(
          requestMatches({ url: "/v2/transcript", method: "POST" }),
          JSON.stringify({ error: message }),
          { status: 400 },
        );

        await expect(
          assembly.transcripts[method]({
            audio_url: remoteAudioURL,
            language_detection: true,
            language_detection_options: languageDetectionOptions,
          }),
        ).rejects.toThrow(new Error(message));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const requestBody = JSON.parse(
          fetchMock.mock.calls[0][1]?.body as string,
        );
        expect(requestBody.language_detection_options).toEqual(
          languageDetectionOptions,
        );
      },
    );
  });

  it("should submit fallback without a language when the API accepts it", async () => {
    const languageDetectionOptions: LanguageDetectionOptions = {
      on_no_speech_detected: "fallback",
    };
    const queuedResponse = { id: transcriptId, status: "queued" };
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify(queuedResponse),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      language_detection: true,
      language_detection_options: languageDetectionOptions,
    });

    expect(transcript).toEqual(queuedResponse);
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.language_detection_options).toEqual(
      languageDetectionOptions,
    );
    expect(requestBody.language_detection_options).not.toHaveProperty(
      "fallback_language",
    );
  });
});
