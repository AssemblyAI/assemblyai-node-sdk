/**
 * A single message in a chat completion request.
 */
export type ChatCompletionMessage = {
  role: "user" | "assistant" | "system";
  content?: string | { type: string; text: string }[];
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
};

/**
 * A request to the LLM Gateway's OpenAI-compatible chat completions endpoint.
 * Uncommon fields (e.g. `fallback_config`, `transcript_id`) can still be
 * passed by name even though they aren't individually typed here.
 */
export type ChatCompletionRequest = {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  response_format?: unknown;
  /** SSE streaming is not supported by this client yet. */
  stream?: boolean;
  [key: string]: unknown;
};

export type ChatCompletionUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type ChatCompletionChoice = {
  index: number;
  finish_reason?: string;
  message: ChatCompletionMessage;
};

/**
 * The response from the LLM Gateway's chat completions endpoint.
 */
export type ChatCompletionResponse = {
  request_id: string;
  choices: ChatCompletionChoice[];
  usage: ChatCompletionUsage;
};

export type ModelDefaultParameters = {
  temperature?: number | null;
  top_p?: number | null;
  frequency_penalty?: number | null;
};

export type ModelTopProvider = {
  is_moderated: boolean;
  context_length: number;
  max_completion_tokens: number;
};

export type ModelPricingData = {
  completions: number;
  prompt: number;
  input_cache_read?: number;
  input_cache_write?: number;
  input_cache_write_1h?: number;
};

export type ModelPricing = {
  us?: ModelPricingData;
  eu?: ModelPricingData;
  global: ModelPricingData;
  regional_increase_percent?: number;
};

/**
 * A model available on the LLM Gateway.
 */
export type ModelDetails = {
  id: string;
  name: string;
  description: string;
  default_parameters: ModelDefaultParameters;
  supported_parameters: string[];
  top_provider: ModelTopProvider;
  context_length: number;
  pricing: ModelPricing;
  creator: string;
  retirement_date: number;
  available_regions: string[];
  providers: string[];
  default_provider: string;
};

/**
 * The response from the LLM Gateway's `/v1/models` endpoint.
 */
export type ListModelsResponse = {
  data: ModelDetails[];
};

/**
 * A request to `/v1/understanding` or `/v1/understanding/validate`. The
 * backend itself treats this as loosely-typed JSON with pluggable feature
 * keys under `speech_understanding.request` (e.g. `speaker_identification`,
 * `translation`, `custom_formatting`, `summarization`, `action_items`), so
 * only the envelope is typed here.
 */
export type LlmGatewaySpeechUnderstandingRequest = {
  speech_understanding: {
    request: Record<string, { version?: string } & Record<string, unknown>>;
  };
  /** Fetch the transcript to run features against by id, instead of inlining it. */
  transcript_id?: string;
  [key: string]: unknown;
};

/**
 * The response from `/v1/understanding`. Shape varies by feature and
 * transcript source, so it is left loosely typed.
 */
export type LlmGatewaySpeechUnderstandingResponse = Record<string, unknown>;
