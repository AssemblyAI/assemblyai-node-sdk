import fetchMock from "jest-fetch-mock";
import { SpeakerOptions } from "../../src";
import {
  createClient,
  requestMatches,
} from "./utils";

fetchMock.enableMocks();

const assembly = createClient();
const transcriptId = "transcript_123";
const remoteAudioURL = "https://assembly.ai/espn.m4a";

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.resetMocks();
  fetchMock.doMock();
});

describe("speaker options", () => {
  it("should create transcript with speaker_options", async () => {
    const speakerOptions: SpeakerOptions = {
      min_speakers_expected: 2,
      max_speakers_expected: 4,
    };

    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speaker_labels: true,
      speaker_options: speakerOptions,
    });

    expect(transcript.id).toBe(transcriptId);
    expect(transcript.status).toBe("queued");

    // Verify the request body included speaker_options
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.speaker_labels).toBe(true);
    expect(requestBody.speaker_options).toEqual(speakerOptions);
  });

  it("should create transcript with only min_speakers_expected", async () => {
    const speakerOptions: SpeakerOptions = {
      min_speakers_expected: 3,
    };

    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speaker_labels: true,
      speaker_options: speakerOptions,
    });

    expect(transcript.id).toBe(transcriptId);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.speaker_options.min_speakers_expected).toBe(3);
    expect(requestBody.speaker_options.max_speakers_expected).toBeUndefined();
  });

  it("should create transcript with only max_speakers_expected", async () => {
    const speakerOptions: SpeakerOptions = {
      max_speakers_expected: 5,
    };

    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speaker_labels: true,
      speaker_options: speakerOptions,
    });

    expect(transcript.id).toBe(transcriptId);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.speaker_options.min_speakers_expected).toBeUndefined();
    expect(requestBody.speaker_options.max_speakers_expected).toBe(5);
  });

  it("should create transcript with speakers_expected (without speaker_options)", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speaker_labels: true,
      speakers_expected: 3,
    });

    expect(transcript.id).toBe(transcriptId);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.speaker_labels).toBe(true);
    expect(requestBody.speakers_expected).toBe(3);
    expect(requestBody.speaker_options).toBeUndefined();
  });

  it("should handle null speaker_options", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    const transcript = await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speaker_labels: true,
      speaker_options: null,
    });

    expect(transcript.id).toBe(transcriptId);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.speaker_options).toBe(null);
  });
});
