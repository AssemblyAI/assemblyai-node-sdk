import { AudioEncoding } from "..";

export type LLMGatewayMessage = {
  role: string;
  content: string;
};

export type LLMGatewayConfig = {
  model: string;
  messages: LLMGatewayMessage[];
  max_tokens: number;
};

export type StreamingTranscriberParams = {
  websocketBaseUrl?: string;
  apiKey?: string;
  token?: string;
  sampleRate: number;
  encoding?: AudioEncoding;
  endOfTurnConfidenceThreshold?: number;
  /**
   * @deprecated Use `minTurnSilence` instead. This parameter will be removed in a future release.
   */
  minEndOfTurnSilenceWhenConfident?: number;
  minTurnSilence?: number;
  maxTurnSilence?: number;
  vadThreshold?: number;
  formatTurns?: boolean;
  filterProfanity?: boolean;
  keyterms?: string[];
  keytermsPrompt?: string[];
  prompt?: string;
  speechModel: StreamingSpeechModel;
  languageDetection?: boolean;
  inactivityTimeout?: number;
  speakerLabels?: boolean;
  maxSpeakers?: number;
  llmGateway?: LLMGatewayConfig;
};

export type StreamingEvents =
  | "open"
  | "close"
  | "turn"
  | "speechStarted"
  | "llmGatewayResponse"
  | "error";

export type StreamingListeners = {
  open?: (event: BeginEvent) => void;
  close?: (code: number, reason: string) => void;
  turn?: (event: TurnEvent) => void;
  speechStarted?: (event: SpeechStartedEvent) => void;
  llmGatewayResponse?: (event: LLMGatewayResponseEvent) => void;
  error?: (error: Error) => void;
};

export type StreamingSpeechModel =
  | "universal-streaming-english"
  | "universal-streaming-multilingual"
  | "u3-rt-pro"
  | "whisper-rt"
  | "u3-pro";

export type StreamingTokenParams = {
  expires_in_seconds: number;
  max_session_duration_seconds?: number;
};

export type StreamingTemporaryTokenResponse = {
  token: string;
};

export type StreamingAudioData = ArrayBufferLike;

export type BeginEvent = {
  type: "Begin";
  id: string;
  expires_at: number;
};

export type SpeechStartedEvent = {
  type: "SpeechStarted";
  timestamp: number;
};

export type TurnEvent = {
  type: "Turn";
  turn_order: number;
  turn_is_formatted: boolean;
  end_of_turn: boolean;
  transcript: string;
  end_of_turn_confidence: number;
  words: StreamingWord[];
  language_code?: string;
  language_confidence?: number;
  speaker_label?: string;
};

export type StreamingWord = {
  start: number;
  end: number;
  confidence: number;
  text: string;
  word_is_final: boolean;
};

export type TerminationEvent = {
  type: "Termination";
  audio_duration_seconds: number;
  session_duration_seconds: number;
};

export type StreamingTerminateSession = {
  type: "Terminate";
};

export type StreamingUpdateConfiguration = {
  type: "UpdateConfiguration";
  end_of_turn_confidence_threshold?: number;
  /**
   * @deprecated Use `min_turn_silence` instead. This parameter will be removed in a future release.
   */
  min_end_of_turn_silence_when_confident?: number;
  min_turn_silence?: number;
  max_turn_silence?: number;
  vad_threshold?: number;
  format_turns?: boolean;
  keyterms_prompt?: string[];
  prompt?: string;
  filter_profanity?: boolean;
};

export type StreamingForceEndpoint = {
  type: "ForceEndpoint";
};

export type ErrorEvent = {
  error: string;
};

export type LLMGatewayResponseEvent = {
  type: "LLMGatewayResponse";
  turn_order: number;
  transcript: string;
  data: unknown;
};

export type StreamingEventMessage =
  | BeginEvent
  | TurnEvent
  | SpeechStartedEvent
  | TerminationEvent
  | LLMGatewayResponseEvent
  | ErrorEvent;

export type StreamingOperationMessage =
  | StreamingUpdateConfiguration
  | StreamingForceEndpoint
  | StreamingTerminateSession;
