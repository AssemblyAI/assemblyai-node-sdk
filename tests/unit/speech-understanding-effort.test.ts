import fetchMock from "jest-fetch-mock";
import {
  CustomFormattingRequest,
  SpeakerIdentificationRequest,
  SpeechUnderstandingEffort,
  TranslationRequest,
} from "../../src";
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

const mockSubmit = () =>
  fetchMock.doMockOnceIf(
    requestMatches({ url: "/v2/transcript", method: "POST" }),
    JSON.stringify({ id: transcriptId, status: "queued" }),
  );

const submittedRequest = () =>
  JSON.parse(fetchMock.mock.calls[0][1]?.body as string).speech_understanding
    .request;

describe("speech understanding effort", () => {
  it("should create transcript with speaker_identification effort", async () => {
    const speakerIdentification: SpeakerIdentificationRequest = {
      speaker_type: "name",
      effort: "medium",
    };
    mockSubmit();

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speaker_labels: true,
      speech_understanding: {
        request: { speaker_identification: speakerIdentification },
      },
    });

    expect(transcript.id).toBe(transcriptId);
    expect(transcript.status).toBe("queued");
    expect(submittedRequest().speaker_identification).toEqual(
      speakerIdentification,
    );
  });

  it("should create transcript with translation effort", async () => {
    const translation: TranslationRequest = {
      target_languages: ["es", "fr"],
      effort: "medium",
    };
    mockSubmit();

    await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speech_understanding: { request: { translation } },
    });

    expect(submittedRequest().translation).toEqual(translation);
  });

  it("should create transcript with custom_formatting effort", async () => {
    const customFormatting: CustomFormattingRequest = {
      date: "mm/dd/yyyy",
      effort: "medium",
    };
    mockSubmit();

    await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speech_understanding: {
        request: { custom_formatting: customFormatting },
      },
    });

    expect(submittedRequest().custom_formatting).toEqual(customFormatting);
  });

  it("should set effort per task independently", async () => {
    mockSubmit();

    await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speaker_labels: true,
      speech_understanding: {
        request: {
          speaker_identification: { speaker_type: "name", effort: "medium" },
          translation: { target_languages: ["es"], effort: "low" },
        },
      },
    });

    const request = submittedRequest();
    expect(request.speaker_identification.effort).toBe("medium");
    expect(request.translation.effort).toBe("low");
  });

  it("should omit effort when it isn't set", async () => {
    mockSubmit();

    await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speaker_labels: true,
      speech_understanding: {
        request: {
          speaker_identification: {
            speaker_type: "role",
            known_values: ["Agent", "Customer"],
          },
        },
      },
    });

    const speakerIdentification = submittedRequest().speaker_identification;
    expect(speakerIdentification.speaker_type).toBe("role");
    expect(speakerIdentification.known_values).toEqual(["Agent", "Customer"]);
    expect(speakerIdentification.effort).toBeUndefined();
  });

  it("should accept every documented effort value", () => {
    const efforts: SpeechUnderstandingEffort[] = ["low", "medium"];

    for (const effort of efforts) {
      const speakerIdentification: SpeakerIdentificationRequest = {
        speaker_type: "name",
        effort,
      };
      const translation: TranslationRequest = {
        target_languages: ["es"],
        effort,
      };
      const customFormatting: CustomFormattingRequest = { effort };

      expect(speakerIdentification.effort).toBe(effort);
      expect(translation.effort).toBe(effort);
      expect(customFormatting.effort).toBe(effort);
    }
  });
});
