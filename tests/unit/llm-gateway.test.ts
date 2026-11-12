import fetchMock from "jest-fetch-mock";
import { LlmGatewayError } from "../../src";
import { createClient, requestMatches } from "./utils";

fetchMock.enableMocks();

const assembly = createClient();

const completionResponse = {
  request_id: "req_123",
  choices: [
    {
      index: 0,
      finish_reason: "stop",
      message: { role: "assistant", content: "hi there" },
    },
  ],
  usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
};

const modelsResponse = {
  data: [
    {
      id: "claude-haiku-4-5-20251001",
      name: "Claude Haiku 4.5",
      description: "Fast, affordable model",
      default_parameters: { temperature: 1, top_p: 1, frequency_penalty: 0 },
      supported_parameters: ["stream", "tools", "temperature"],
      top_provider: {
        is_moderated: false,
        context_length: 200000,
        max_completion_tokens: 8192,
      },
      context_length: 200000,
      pricing: { global: { completions: 0.000005, prompt: 0.000001 } },
      creator: "anthropic",
      retirement_date: 0,
      available_regions: ["global"],
      providers: ["bedrock"],
      default_provider: "bedrock",
    },
  ],
};

function requestBody(): unknown {
  return JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
}

beforeEach(() => {
  fetchMock.resetMocks();
  fetchMock.doMock();
});

describe("llmGateway", () => {
  it("should create a chat completion", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v1/chat/completions", method: "POST" }),
      JSON.stringify(completionResponse),
    );
    const result = await assembly.llmGateway.chatCompletions({
      model: "claude-haiku-4-5-20251001",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.request_id).toBe("req_123");
    expect(result.choices[0].message.content).toBe("hi there");
    expect(requestBody()).toMatchObject({
      model: "claude-haiku-4-5-20251001",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("should reject stream: true before making a request", async () => {
    await expect(
      assembly.llmGateway.chatCompletions({
        model: "claude-haiku-4-5-20251001",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      }),
    ).rejects.toThrow("does not support stream: true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should list models", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v1/models", method: "GET" }),
      JSON.stringify(modelsResponse),
    );
    const result = await assembly.llmGateway.listModels();
    expect(result.data[0].id).toBe("claude-haiku-4-5-20251001");
  });

  it("should run a speech understanding request", async () => {
    const response = {
      speech_understanding: {
        response: { summarization: { status: "success" } },
      },
      request_id: "req_456",
    };
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v1/understanding", method: "POST" }),
      JSON.stringify(response),
    );
    const result = await assembly.llmGateway.understanding({
      transcript_id: "abc-123",
      speech_understanding: { request: { summarization: { version: "v1" } } },
    });
    expect(result).toEqual(response);
  });

  it("should validate a speech understanding request", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v1/understanding/validate", method: "POST" }),
      "",
    );
    await expect(
      assembly.llmGateway.validateUnderstanding({
        transcript_id: "abc-123",
        speech_understanding: { request: { summarization: { version: "v1" } } },
      }),
    ).resolves.toBeUndefined();
  });

  it("should run a decisions request", async () => {
    const response = {
      request_id: "req_dec",
      model: "gpt-6-luna",
      answers: [
        { type: "predicate", name: "resolved", probability: 0.9 },
        {
          type: "score",
          name: "politeness",
          score: 0.8,
          probabilities: [
            { value: 0, label: "rude", probability: 0.2 },
            { value: 1, label: "polite", probability: 0.8 },
          ],
        },
      ],
      usage: {
        input_tokens: 120,
        input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
        output_tokens: 0,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 120,
      },
    };
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v1/decisions", method: "POST" }),
      JSON.stringify(response),
    );
    const request = {
      model: "gpt-6-luna",
      input: "Caller: thanks, that fixed it!",
      questions: [
        {
          type: "predicate" as const,
          name: "resolved",
          instructions: "Was the issue resolved?",
        },
        {
          type: "score" as const,
          name: "politeness",
          instructions: "How polite was the agent?",
          levels: [
            { label: "rude", description: "Dismissive" },
            { label: "polite", description: "Courteous" },
          ],
        },
      ],
      prompt_cache_key: "call-123",
      brand_new_param: true,
    };
    const result = await assembly.llmGateway.decisions(request);
    expect(result).toEqual(response);
    expect(requestBody()).toEqual(request);
  });

  it("should map the post-auth error envelope to an LlmGatewayError", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        message: "invalid request body",
        request_id: "req_789",
        metadata: { errors: ["'model' is required"] },
      }),
      { status: 400 },
    );
    const promise = assembly.llmGateway.chatCompletions({
      model: "",
      messages: [],
    });
    await expect(promise).rejects.toThrow(LlmGatewayError);
    await expect(promise).rejects.toMatchObject({
      message: "invalid request body",
      status: 400,
      requestId: "req_789",
      errors: ["'model' is required"],
    });
  });

  it("should map the pre-auth error envelope to an LlmGatewayError", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        error: "Authentication error, API token missing/invalid",
        status: "error",
        request_id: "req_000",
      }),
      { status: 401 },
    );
    await expect(assembly.llmGateway.listModels()).rejects.toMatchObject({
      message: "Authentication error, API token missing/invalid",
      status: 401,
      requestId: "req_000",
    });
  });
});
