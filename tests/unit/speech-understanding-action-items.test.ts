import fetchMock from "jest-fetch-mock";
import { ActionItem, ActionItemsRequest, ActionItemsResponse } from "../../src";
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

describe("speech understanding action items", () => {
  it("should submit every action_items option", async () => {
    const actionItems: ActionItemsRequest = {
      include_decisions: true,
      effort: "medium",
    };
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" }),
    );

    await assembly.transcripts.submit({
      audio_url: remoteAudioURL,
      speech_understanding: { request: { action_items: actionItems } },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.speech_understanding.request.action_items).toEqual(actionItems);
  });

  it("should type the action_items response", () => {
    const item: ActionItem = {
      action_item: "Schedule follow-up meeting with team",
      quote: "Let's schedule a follow-up next Tuesday.",
      timestamp: 45000,
    };
    const response: ActionItemsResponse = {
      status: "success",
      effort: "medium",
      items: [item],
    };

    expect(response.status).toBe("success");
    expect(response.effort).toBe("medium");
    expect(response.items?.[0].action_item).toBe(
      "Schedule follow-up meeting with team",
    );
    expect(response.items?.[0].quote).toBe(
      "Let's schedule a follow-up next Tuesday.",
    );
    expect(response.items?.[0].timestamp).toBe(45000);
  });
});
