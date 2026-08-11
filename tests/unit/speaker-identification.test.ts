import fetchMock from "jest-fetch-mock";
import {
  SpeakerIdentificationEffort,
  SpeakerIdentificationRequest,
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

describe("speaker identification", () => {
  it("should create transcript with speaker_identification effort", async () => {
    const speakerIdentification: SpeakerIdentificationRequest = {
      speaker_type: "name",
      effort: "medium",
    };

    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speaker_labels: true,
      speech_understanding: {
        request: { speaker_identification: speakerIdentification },
      },
    });

    expect(transcript.id).toBe(transcriptId);
    expect(transcript.status).toBe("queued");

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(
      requestBody.speech_understanding.request.speaker_identification,
    ).toEqual(speakerIdentification);
  });

  it("should create transcript with speaker_identification without effort", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
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

    expect(transcript.id).toBe(transcriptId);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    const speakerIdentification =
      requestBody.speech_understanding.request.speaker_identification;
    expect(speakerIdentification.speaker_type).toBe("role");
    expect(speakerIdentification.known_values).toEqual(["Agent", "Customer"]);
    expect(speakerIdentification.effort).toBeUndefined();
  });

  it("should accept every documented effort value", () => {
    const efforts: SpeakerIdentificationEffort[] = ["low", "medium"];

    for (const effort of efforts) {
      const speakerIdentification: SpeakerIdentificationRequest = {
        speaker_type: "name",
        effort,
      };
      expect(speakerIdentification.effort).toBe(effort);
    }
  });
});
