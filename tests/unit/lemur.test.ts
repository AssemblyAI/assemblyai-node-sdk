import fetchMock from "jest-fetch-mock";
import { createClient, requestMatches } from "./utils";
import { LemurTaskResponse } from "../../src";

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
      JSON.stringify(lemurResponse),
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
      }),
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
      JSON.stringify(lemurResponse),
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
      JSON.stringify(lemurResponse),
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
      { status: 500 },
    );
    const promise = assembly.lemur.summary({
      final_model: "basic",
      transcript_ids: ["bad-id"],
      answer_format: "one sentence",
    });

    await expect(promise).rejects.toThrowError(
      "each transcript source id must be valid",
    );
  });

  it("should return response", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({
        method: "GET",
        url: `/lemur/v3/${knownLemurRequestId}`,
      }),
      JSON.stringify({
        request_id: knownLemurRequestId,
        response: "some response",
      }),
    );
    const response = await assembly.lemur.getResponse(knownLemurRequestId);
    expect(response).toBeTruthy();
    expect(response.request_id).toBe(knownLemurRequestId);
    expect(response.response).toBe("some response");
  });

  it("should return response with generic", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({
        method: "GET",
        url: `/lemur/v3/${knownLemurRequestId}`,
      }),
      JSON.stringify({
        request_id: knownLemurRequestId,
        response: "some response",
      }),
    );
    const response =
      await assembly.lemur.getResponse<LemurTaskResponse>(knownLemurRequestId);
    expect(response).toBeTruthy();
    expect(response.request_id).toBe(knownLemurRequestId);
    expect(response.response).toBe("some response");
  });

  it("should return response with request details", async () => {
    const responseWithDetails = {
      request_id: knownLemurRequestId,
      response: "detailed response",
      usage: {
        input_tokens: 250,
        output_tokens: 75,
      },
      request: {
        request_endpoint: "/lemur/v3/generate/task",
        temperature: 0.7,
        final_model: "anthropic/claude-3-5-sonnet",
        max_output_size: 1500,
        created_at: "2024-01-01T10:30:00Z",
        transcript_ids: knownTranscriptIds,
        prompt: "Analyze the key themes in this conversation",
        context: "Focus on business decisions and action items",
      },
    };

    fetchMock.doMockOnceIf(
      requestMatches({
        method: "GET",
        url: `/lemur/v3/${knownLemurRequestId}`,
      }),
      JSON.stringify(responseWithDetails),
    );

    const response = await assembly.lemur.getResponse(knownLemurRequestId);
    expect(response.request_id).toBe(knownLemurRequestId);
    expect(response.request).toBeDefined();
    expect(response.request?.request_endpoint).toBe("/lemur/v3/generate/task");
    expect(response.request?.temperature).toBe(0.7);
    expect(response.request?.final_model).toBe("anthropic/claude-3-5-sonnet");
    expect(response.request?.max_output_size).toBe(1500);
    expect(response.request?.prompt).toBe(
      "Analyze the key themes in this conversation",
    );
    expect(response.usage.input_tokens).toBe(250);
    expect(response.usage.output_tokens).toBe(75);
  });

  it("should return response with question-answer request details", async () => {
    const qaResponseWithDetails = {
      request_id: knownLemurRequestId,
      response: [
        { question: "What was discussed?", answer: "Project updates" },
      ],
      usage: {
        input_tokens: 300,
        output_tokens: 100,
      },
      request: {
        request_endpoint: "/lemur/v3/generate/question-answer",
        temperature: 0.3,
        final_model: "anthropic/claude-3-opus",
        max_output_size: 2500,
        created_at: "2024-01-01T14:15:00Z",
        input_text: "Custom transcript content...",
        questions: [
          {
            question: "What was discussed?",
            answer_format: "concise summary",
            context: "Meeting notes",
          },
          {
            question: "Was the date of the next meeting called out?",
            answer_options: ["Yes", "No", "Not mentioned"],
          },
        ],
      },
    };

    fetchMock.doMockOnceIf(
      requestMatches({
        method: "GET",
        url: `/lemur/v3/${knownLemurRequestId}`,
      }),
      JSON.stringify(qaResponseWithDetails),
    );

    const response = await assembly.lemur.getResponse(knownLemurRequestId);
    expect(response.request?.request_endpoint).toBe(
      "/lemur/v3/generate/question-answer",
    );
    expect(response.request?.input_text).toBe("Custom transcript content...");
    expect(response.request?.questions).toHaveLength(2);
    expect(response.request?.questions?.[0].question).toBe(
      "What was discussed?",
    );
    expect(response.request?.questions?.[0].context).toBe("Meeting notes");
    expect(response.request?.questions?.[1].answer_options).toEqual([
      "Yes",
      "No",
      "Not mentioned",
    ]);
  });

  it("should return response with context as object in request details", async () => {
    const responseWithObjectContext = {
      request_id: knownLemurRequestId,
      response: "context-aware response",
      usage: {
        input_tokens: 180,
        output_tokens: 60,
      },
      request: {
        request_endpoint: "/lemur/v3/generate/summary",
        temperature: 0.5,
        final_model: "default",
        max_output_size: 2000,
        created_at: "2024-01-01T16:45:00Z",
        transcript_ids: knownTranscriptIds,
        context: {
          meeting_type: "standup",
          team: "engineering",
          date: "2024-01-01",
        },
        answer_format: "bullet points",
      },
    };

    fetchMock.doMockOnceIf(
      requestMatches({
        method: "GET",
        url: `/lemur/v3/${knownLemurRequestId}`,
      }),
      JSON.stringify(responseWithObjectContext),
    );

    const response = await assembly.lemur.getResponse(knownLemurRequestId);
    expect(response.request?.context).toEqual({
      meeting_type: "standup",
      team: "engineering",
      date: "2024-01-01",
    });
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
      }),
    );
    const deletionRequest =
      await assembly.lemur.purgeRequestData(knownLemurRequestId);
    expect(deletionRequest.deleted).toBeTruthy();
    expect(deletionRequest.request_id_to_purge).toBe(knownLemurRequestId);
    expect(deletionRequest.request_id).toBe(purgeRequestId);
  });
});
