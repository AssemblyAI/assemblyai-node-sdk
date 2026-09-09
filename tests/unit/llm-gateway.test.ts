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
