import { AudioEncoding } from "..";
import type { Channel, VadDetector, VadFrame } from "./dual-channel";

export * from "./dual-channel";

/**
 * Per-channel attribution tuning for dual-channel mode. All fields optional;
 * ignored when `StreamingTranscriberParams.channels` is not set.
 */
export type ChannelAttributionParams = {
  /** Energy ratio above which a channel is declared dominant for a word. Default 4. */
  dominanceRatio?: number;
  /** Rolling VAD timeline window in ms. Default 30_000. */
  timelineWindowMs?: number;
  /**
   * Factory for the per-channel VAD detector. Called once per declared channel
   * at transcriber construction time. The channel name is passed so factories
   * that wrap higher-level VAD libraries (which manage their own audio source)
   * can map each `VadDetector` instance to its corresponding channel.
   */
  createVad?: (channelName: string) => VadDetector;
  /** Mix flush interval in ms — how often per-channel buffers are summed and sent. Default 50. */
  flushIntervalMs?: number;
  /**
   * Strategy used to fill words whose per-word VAD attribution resolved to
   * `"unknown"`. Confident per-word VAD decisions (`"mic"` / `"system"`) are
   * never modified by any strategy.
   *
   * - `"window"` (default): look at the dominant non-`"unknown"` channel
   *   among ±`resolutionWindowWords` neighboring words in the same turn.
   *   Ignores `speaker_label`, so it works even when AAI re-uses a label for
   *   two physically distinct voices.
   * - `"speaker-history"`: accumulate per-`speaker_label` per-channel active
   *   VAD energy across the session, then fill `"unknown"` words with the
   *   speaker's dominant channel when it clears
   *   `speakerHistoryMinRmsEvidence` and beats runner-up by
   *   `speakerHistoryDominanceRatio`. Robust for stable speaker labels but
   *   does nothing when a speaker has split evidence.
   * - `"none"`: disable resolution; `"unknown"` words remain `"unknown"` in
   *   the output.
   */
  resolveUnknownChannelsMethod?: "none" | "window" | "speaker-history";
  /**
   * Half-window (in words) on each side of an `"unknown"` word for the
   * `"window"` method. Default 2 — so the full window is up to 5 words
   * (2 before + the unknown + 2 after).
   */
  resolutionWindowWords?: number;
  /**
   * Minimum cumulative active-RMS evidence (sum across all the speaker's
   * frames to date) before a speaker can be resolved via the
   * `"speaker-history"` method. Default 0.5 — roughly a few seconds of
   * sustained speech.
   */
  speakerHistoryMinRmsEvidence?: number;
  /**
   * For the `"speaker-history"` method, the top channel's evidence must
   * exceed the runner-up's by at least this factor for the speaker to be
   * considered pinned to that channel. Default 3.
   */
  speakerHistoryDominanceRatio?: number;
};

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
  /**
   * Milliseconds to wait for the streaming handshake (socket open + server
   * `Begin`) before treating the attempt as failed. Defaults to 1000.
   */
  connectTimeout?: number;
  /**
   * Number of additional connection attempts after the first one fails on a
   * transient error (timeout, network drop, unexpected close). 0 disables
   * retries. Permanent failures (auth, insufficient funds, malformed config)
   * are never retried. Defaults to 2.
   */
  maxConnectionRetries?: number;
  /**
   * Milliseconds to wait between connection attempts. Defaults to 500.
   */
  connectionRetryDelay?: number;
  /**
   * Required for PCM encodings (and for dual-channel mode). May be omitted
   * for Opus encodings (`opus`, `ogg_opus`) — the stream is self-describing
   * and the server ignores the value.
   */
  sampleRate?: number;
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
  agentContext?: string;
  speechModel?: StreamingSpeechModel;
  /**
   * @deprecated Use `languageCodes` instead (pass a single-element array, e.g. `["es"]`,
   * for the same behavior). Still supported for backward compatibility.
   */
  languageCode?: string;
  /**
   * Recommended way to select languages. Steers transcription toward a set of
   * languages by biasing output toward them on a per-token basis while still
   * allowing native code-switching among them. Pass the languages you expect
   * (e.g. `["en", "es"]`), or a single-element array (e.g. `["es"]`) for a
   * monolingual session. Universal-3.5 Pro Streaming only.
   */
  languageCodes?: string[];
  languageDetection?: boolean;
  domain?: StreamingDomain;
  inactivityTimeout?: number;
  speakerLabels?: boolean;
  maxSpeakers?: number;
  voiceFocus?: VoiceFocusModel;
  voiceFocusThreshold?: number;
  continuousPartials?: boolean;
  interruptionDelay?: number;
  turnLeftPadMs?: number;
  customerSupportAudioCapture?: boolean;
  includePartialTurns?: boolean;
  redactPii?: boolean;
  redactPiiPolicies?: StreamingPiiPolicy[];
  redactPiiSub?: StreamingPiiSubstitution;
  mode?: StreamingMode;
  llmGateway?: LLMGatewayConfig;
  webhookUrl?: string;
  webhookAuthHeaderName?: string;
  webhookAuthHeaderValue?: string;
  /**
   * Enable dual-channel (or N-channel) mode. Presence of `channels` switches the
   * transcriber into channel-tagged mode: `sendAudio(audio, { channel })` is required,
   * per-channel VAD runs on the raw PCM, the streams are mixed to mono before being
   * sent to the server, and emitted `TurnEvent`s are enriched with `channel` and
   * per-word `channel` attribution.
   *
   * Must contain exactly 2 entries with unique names. The names are echoed back in
   * `TurnEvent.channel` / `words[i].channel`.
   *
   * **Acoustic-leak caveat.** Per-word channel attribution uses energy-based
   * VAD on each channel. If your capture setup lets one channel's audio bleed
   * into another at similar amplitude — typically system audio playing
   * through speakers and being picked up by an open mic — attribution can
   * misfire (mic-tagged words that were actually system). Transcription
   * quality is unaffected; only the `channel` field is. To preserve
   * attribution in speaker-leak setups, apply echo cancellation at capture
   * before feeding audio to the SDK. In browsers, that's
   * `getUserMedia({ audio: { echoCancellation: true } })`. On macOS native,
   * `AVAudioEngine.setVoiceProcessingEnabled(true)` on the input node. If
   * platform-level AEC isn't available, swap in a DNN VAD (e.g. Silero) via
   * `channelAttribution.createVad`. See the dual-channel sample app's
   * README for worked examples.
   */
  channels?: Array<{ name: string }>;
  /** Tuning for dual-channel attribution. Ignored when `channels` is unset. */
  channelAttribution?: ChannelAttributionParams;
};

export type StreamingEvents =
  | "open"
  | "close"
  | "turn"
  | "speechStarted"
  | "llmGatewayResponse"
  | "speakerRevision"
  | "warning"
  | "vad"
  | "error";

export type StreamingListeners = {
  open?: (event: BeginEvent) => void;
  close?: (code: number, reason: string) => void;
  turn?: (event: TurnEvent) => void;
  speechStarted?: (event: SpeechStartedEvent) => void;
  llmGatewayResponse?: (event: LLMGatewayResponseEvent) => void;
  speakerRevision?: (event: SpeakerRevisionEvent) => void;
  warning?: (event: WarningEvent) => void;
  vad?: (event: VadFrame) => void;
  error?: (error: Error) => void;
};

export type StreamingSpeechModel =
  | "universal-streaming-english"
  | "universal-streaming-multilingual"
  | "u3-rt-pro"
  | "u3-rt-pro-beta-1"
  | "whisper-rt"
  | "universal-3-5-pro"
  | "u3-pro";

export type StreamingDomain = "medical-v1";

export type StreamingMode = "max_accuracy" | "min_latency" | "balanced";

export type VoiceFocusModel = "near-field" | "far-field";

export type StreamingPiiSubstitution = "hash" | "entity_name";

// Source of truth: assemblyai/engineering/projects/pii/enums.py (`AAIEntities`).
// Keep this union in sync when entities are added or removed server-side.
export type StreamingPiiPolicy =
  | "account_number"
  | "banking_information"
  | "blood_type"
  | "corporate_action"
  | "credit_card_cvv"
  | "credit_card_expiration"
  | "credit_card_number"
  | "date"
  | "date_interval"
  | "date_of_birth"
  | "day"
  | "drivers_license"
  | "drug"
  | "duration"
  | "effect"
  | "email_address"
  | "event"
  | "filename"
  | "financial_metric"
  | "gender"
  | "gender_sexuality"
  | "healthcare_number"
  | "injury"
  | "ip_address"
  | "language"
  | "location"
  | "location_address"
  | "location_address_street"
  | "location_city"
  | "location_coordinate"
  | "location_country"
  | "location_state"
  | "location_zip"
  | "marital_status"
  | "medical_code"
  | "medical_condition"
  | "medical_process"
  | "money_amount"
  | "month"
  | "nationality"
  | "number_sequence"
  | "occupation"
  | "organization"
  | "organization_id"
  | "organization_medical_facility"
  | "passport_number"
  | "password"
  | "person_age"
  | "person_name"
  | "phone_number"
  | "physical_attribute"
  | "political_affiliation"
  | "product"
  | "project"
  | "religion"
  | "sexuality"
  | "statistics"
  | "time"
  | "trend"
  | "url"
  | "us_social_security_number"
  | "username"
  | "vehicle_id"
  | "year"
  | "zodiac_sign";

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
  /**
   * Duration-weighted majority channel across `words[i].channel`. Populated only
   * when the transcriber is configured with `channels`. Independent from
   * `speaker_label`.
   */
  channel?: Channel;
};

export type StreamingWord = {
  start: number;
  end: number;
  confidence: number;
  text: string;
  word_is_final: boolean;
  speaker?: string;
  /**
   * Physical input channel attributed by client-side VAD during this word's
   * time window. Populated only when the transcriber is configured with
   * `channels`. Independent from `speaker`.
   */
  channel?: Channel;
  /**
   * True if `channel` was filled in by `channelAttribution.resolveUnknownChannelsMethod`
   * rather than by the per-word VAD. Only set on words whose per-word VAD
   * attribution was `"unknown"` and whose resolution method produced a
   * confident channel. Useful for debugging or rendering an indicator that a
   * word's channel came from context, not direct VAD evidence.
   */
  channelResolved?: boolean;
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
  agent_context?: string;
  filter_profanity?: boolean;
  interruption_delay?: number;
  turn_left_pad_ms?: number;
  /**
   * Steer transcription toward a set of languages mid-stream. Pass an empty
   * array (`[]`) to clear steering and restore the model's default
   * multilingual code-switching. Universal-3.5 Pro Streaming only.
   */
  language_codes?: string[];
};

export type StreamingForceEndpoint = {
  type: "ForceEndpoint";
};

export type StreamingKeepAlive = {
  type: "KeepAlive";
};

export type ErrorEvent = {
  type: "Error";
  error_code?: number;
  error: string;
};

export type WarningEvent = {
  type: "Warning";
  warning_code: number;
  warning: string;
};

export type LLMGatewayResponseEvent = {
  type: "LLMGatewayResponse";
  turn_order: number;
  transcript: string;
  data: unknown;
};

/**
 * A single earlier Turn whose speaker labels were revised by reclustering.
 * Match by `turn_order` against the original Turn; replace its per-word
 * `speaker` assignments (and the turn-level `speaker_label`) with these. Text
 * and word timestamps are unchanged from the original Turn.
 */
export type SpeakerRevisionItem = {
  turn_order: number;
  speaker_label?: string;
  words: StreamingWord[];
};

/**
 * Server-side correction to previously-emitted Turns' speaker labels.
 * Diarization-only (emitted only when `speakerLabels` is enabled). Sent once
 * per offline-recluster resolve; `revisions` carries one entry per earlier
 * Turn whose label actually changed (unchanged turns are omitted). Apply each
 * entry by matching its `turn_order`.
 */
export type SpeakerRevisionEvent = {
  type: "SpeakerRevision";
  revisions: SpeakerRevisionItem[];
};

export type StreamingEventMessage =
  | BeginEvent
  | TurnEvent
  | SpeechStartedEvent
  | TerminationEvent
  | LLMGatewayResponseEvent
  | SpeakerRevisionEvent
  | ErrorEvent
  | WarningEvent;

export type StreamingOperationMessage =
  | StreamingUpdateConfiguration
  | StreamingForceEndpoint
  | StreamingKeepAlive
  | StreamingTerminateSession;
