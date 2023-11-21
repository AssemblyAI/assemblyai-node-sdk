import fetchMock from "jest-fetch-mock";
import { AssemblyAI } from "../src";
import { createClient, requestMatches } from "./utils";

const knownTranscriptIds = ["transcript_123"];
const knownLemurRequestId = "lemur_123";
const purgeRequestId = "purger_123";

fetchMock.enableMocks();

const assembly = createClient();

const lemurResponse = {
  response: "some response",
  requestId: knownLemurRequestId,
};

beforeEach(() => {
  fetchMock.resetMocks();
  fetchMock.doMock();
});

describe("lemur", () => {
  it("should generate a summary", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ method: "POST", url: "/lemur/v3/generate/summary" }),
      JSON.stringify(lemurResponse)
    );
    const { response } = await assembly.lemur.summary({
      final_model: "basic",
      transcript_ids: knownTranscriptIds,
      answer_format: "one sentence",
    });

    expect(response).toBeTruthy();
  });

  it("should generate an answer", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({
        method: "POST",
        url: "/lemur/v3/generate/question-answer",
      }),
      JSON.stringify({
        ...lemurResponse,
        response: [
          {
            question: "question",
            answer: "answer",
          },
        ],
      })
    );
    const { response } = await assembly.lemur.questionAnswer({
      final_model: "basic",
      transcript_ids: knownTranscriptIds,
      questions: [
        {
          question: "What are they discussing?",
          answer_format: "text",
        },
      ],
    });

    expect(response).toBeTruthy();
    expect(response).toHaveLength(1);
  });

  it("should generate action items", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({
        method: "POST",
        url: "/lemur/v3/generate/action-items",
      }),
      JSON.stringify(lemurResponse)
    );
    const { response } = await assembly.lemur.actionItems({
      final_model: "basic",
      transcript_ids: knownTranscriptIds,
    });

    expect(response).toBeTruthy();
  });

  it("should generate a task", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ method: "POST", url: "/lemur/v3/generate/task" }),
      JSON.stringify(lemurResponse)
    );
    const { response } = await assembly.lemur.task({
      final_model: "basic",
      transcript_ids: knownTranscriptIds,
      prompt: "Write a haiku about this conversation.",
    });

    expect(response).toBeTruthy();
  });

  it("should fail to generate a summary", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        error: "each transcript source id must be valid",
      }),
      { status: 500 }
    );
    const promise = assembly.lemur.summary({
      final_model: "basic",
      transcript_ids: ["bad-id"],
      answer_format: "one sentence",
    });

    await expect(promise).rejects.toThrowError(
      "each transcript source id must be valid"
    );
  });

  it("should purge request data", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({
        method: "DELETE",
        url: `/lemur/v3/${knownLemurRequestId}`,
      }),
      JSON.stringify({
        deleted: true,
        request_id: purgeRequestId,
        request_id_to_purge: knownLemurRequestId,
      })
    );
    const deletionRequest = await assembly.lemur.purgeRequestData(
      knownLemurRequestId
    );
    expect(deletionRequest.deleted).toBeTruthy();
    expect(deletionRequest.request_id_to_purge).toBe(knownLemurRequestId);
    expect(deletionRequest.request_id).toBe(purgeRequestId);
  });
});
