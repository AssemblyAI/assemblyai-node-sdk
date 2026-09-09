import { BaseService } from "../base";
import {
  BaseServiceParams,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ListModelsResponse,
  LlmGatewaySpeechUnderstandingRequest,
  LlmGatewaySpeechUnderstandingResponse,
} from "../..";
import { LlmGatewayError } from "../../utils/errors/llm-gateway";

/**
 * The LLM Gateway service: an OpenAI-compatible chat completions API plus
 * AssemblyAI's Speech Understanding endpoints.
 */
export class LlmGatewayService extends BaseService {
  /**
   * Create a new LLM Gateway service.
   * @param params - The parameters to use for the service.
   */
  constructor(params: BaseServiceParams) {
    super(params);
  }

  /**
   * Create a chat completion.
   * @param request - The chat completion request. `stream: true` is not
   * supported by this client yet.
   * @throws LlmGatewayError when the request fails.
   */
  async chatCompletions(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    if (request.stream) {
      throw new Error(
        "LlmGatewayService.chatCompletions does not support stream: true yet",
      );
    }
    const response = await this.fetchResponse("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(request),
    });
    if (!response.ok) throw await errorFromResponse(response);
    return (await response.json()) as ChatCompletionResponse;
  }

  /**
   * List the models available on the LLM Gateway.
   * @throws LlmGatewayError when the request fails.
   */
  async listModels(): Promise<ListModelsResponse> {
    const response = await this.fetchResponse("/v1/models", {
      method: "GET",
    });
    if (!response.ok) throw await errorFromResponse(response);
    return (await response.json()) as ListModelsResponse;
  }

  /**
   * Run a Speech Understanding request.
   * @throws LlmGatewayError when the request fails.
   */
  async understanding(
    request: LlmGatewaySpeechUnderstandingRequest,
  ): Promise<LlmGatewaySpeechUnderstandingResponse> {
    const response = await this.fetchResponse("/v1/understanding", {
      method: "POST",
      body: JSON.stringify(request),
    });
    if (!response.ok) throw await errorFromResponse(response);
    return (await response.json()) as LlmGatewaySpeechUnderstandingResponse;
  }

  /**
   * Validate a Speech Understanding request without running it.
   * @throws LlmGatewayError when the request is invalid.
   */
  async validateUnderstanding(
    request: LlmGatewaySpeechUnderstandingRequest,
  ): Promise<void> {
    const response = await this.fetchResponse("/v1/understanding/validate", {
      method: "POST",
      body: JSON.stringify(request),
    });
    if (!response.ok) throw await errorFromResponse(response);
  }
}

/**
 * Build an LlmGatewayError from a non-ok response. Handles both error
 * envelopes the gateway returns: the post-auth envelope (message, request_id,
 * metadata.errors), and the pre-auth envelope (error, status, request_id)
 * used for authentication/authorization failures.
 */
async function errorFromResponse(response: Response): Promise<LlmGatewayError> {
  let message: string | undefined;
  let requestId: string | undefined;
  let errors: string[] | undefined;

  const text = await response.text();
  try {
    const body = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      if (typeof body.message === "string") message = body.message;
      else if (typeof body.error === "string") message = body.error;
      if (typeof body.request_id === "string") requestId = body.request_id;
      if (Array.isArray(body.metadata?.errors)) errors = body.metadata.errors;
    }
  } catch {
    if (text) message = text;
  }
  if (!message) {
    message = `llm gateway request failed with status ${response.status}`;
  }

  return new LlmGatewayError(message, response.status, requestId, errors);
}
