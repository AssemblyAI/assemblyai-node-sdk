import fetchMock from "jest-fetch-mock";
import { SummarizationRequest, SummarizationResponse } from "../../src";
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

describe("speech understanding summarization", () => {
  it("should submit every summarization option", async () => {
    const summarization: SummarizationRequest = {
      summary_type: "bullets",
      headline_length: 8,
      approximate_chapters: 4,
      effort: "medium",
    };
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speech_understanding: { request: { summarization } },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.speech_understanding.request.summarization).toEqual(
      summarization,
    );
  });

  it("should type the summarization response", () => {
    const response: SummarizationResponse = {
      status: "success",
      summary_type: "paragraph",
      effort: "low",
      block_summary: "A summary.",
      summary: [{ start: 0, end: 1000, text: "A summary.", headline: "Intro" }],
    };

    expect(response.summary?.[0].headline).toBe("Intro");
  });
});
