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

/**
 * A question in a `/v1/decisions` request. `choices` is required for
 * `choice` questions and `levels` for `score` questions.
 */
export type DecisionQuestion = {
  type: "predicate" | "choice" | "score";
  /** Unique within the request; echoed on the matching answer. */
  name: string;
  /** A string, or a list of `input_text` / `input_image` parts. */
  instructions: string | Record<string, unknown>[];
  choices?: { value: string; description: string }[];
  levels?: { label: string; description: string }[];
};

/**
 * A request to the LLM Gateway's `/v1/decisions` endpoint. Fields not typed
 * here can still be passed by name.
 */
export type DecisionRequest = {
  model: string;
  /** A string, or a list of OpenAI input items. */
  input: string | Record<string, unknown>[];
  questions: DecisionQuestion[];
  prompt_cache_key?: string;
  prompt_cache_options?: { mode?: string; ttl?: string };
  provider?: string;
  fallbacks?: Record<string, unknown>[];
  fallback_config?: {
    depth?: number;
    retry?: boolean;
    circuit_breaker?: boolean;
  };
  model_region?: string;
  [key: string]: unknown;
};

export type DecisionProbability = {
  /** The choice value for a `choice` question, or the level index for a `score` question. */
  value: string | number;
  label?: string;
  probability: number;
};

/**
 * The answer to one question, matched to it by `name`. Which fields are set
 * depends on the question `type`.
 */
export type DecisionAnswer = {
  type?: string;
  name?: string;
  probability?: number;
  choice?: string;
  score?: number;
  probabilities?: DecisionProbability[];
  confidence?: number;
};

export type DecisionUsage = {
  input_tokens: number;
  input_tokens_details: { cached_tokens: number; cache_write_tokens: number };
  output_tokens: number;
  output_tokens_details: { reasoning_tokens: number };
  total_tokens: number;
};

/**
 * The response from the LLM Gateway's `/v1/decisions` endpoint.
 */
export type DecisionResponse = {
  request_id: string;
  model: string;
  answers: DecisionAnswer[];
  usage: DecisionUsage;
};
