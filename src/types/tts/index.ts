import type { TextToSpeechError } from "../../utils/errors/tts";
import type { LiteralUnion } from "../helpers";

/**
 * Types of the Text-to-Speech API: the HTTP route `POST /v1/speech` and the
 * WebSocket session on `/v1/ws`. Request bodies and server frames keep the
 * API's snake_case names; values the SDK derives (response headers, session
 * parameters) are camelCase, as elsewhere in this SDK.
 */

/** Codec of the audio the API returns. */
export type TextToSpeechEncoding =
  | "pcm_s16le"
  | "pcm_mulaw"
  | "pcm_alaw"
  | "mp3";

/** Container of a PCM or G.711 response on the HTTP route. */
export type TextToSpeechContainer = "raw" | "wav";

/** Sample rates the API produces, in Hz. */
export type TextToSpeechSampleRate =
  | 8000
  | 16000
  | 22050
  | 24000
  | 44100
  | 48000;

/**
 * The language, by its English name: `english` (the default), `spanish`,
 * `german`, `french`, `italian` or `portuguese`. Case-insensitive.
 */
export type TextToSpeechLanguage =
  | "english"
  | "spanish"
  | "german"
  | "french"
  | "italian"
  | "portuguese";

/** Options shared by an HTTP request and a session: the voice and the audio. */
export type TextToSpeechVoiceOptions = {
  /**
   * The voice: a voice of the AssemblyAI voice library by its slug, such as
   * `aai-jane` (the default), `aai-alba` or `aai-michael`; a voice's ID (a
   * UUID); or the slug of one of the account's own cloned voices. The
   * dashboard shows the value that names each voice.
   */
  voice_id?: string;
  /** The model to run on, such as `assemblyai-tts-1`. Defaults to the region's default model. */
  model_id?: string;
  /** Defaults to the voice's own language (English for `aai-jane`). */
  language?: LiteralUnion<TextToSpeechLanguage, string>;
  /** Output sample rate in Hz. Defaults to 24000. */
  sample_rate?: TextToSpeechSampleRate;
  /** Output codec. Defaults to `pcm_s16le`. A session streams PCM or G.711 only. */
  encoding?: LiteralUnion<TextToSpeechEncoding, string>;
  /**
   * `true` renews the biometric consent of the cloned voice in `voice_id`,
   * which only the voice's owner may do; a cloned voice expires 60 days
   * after its consent was last given.
   */
  extend_biometric_consent?: boolean;
};

/** The body of `POST /v1/speech`. */
export type SpeechRequest = TextToSpeechVoiceOptions & {
  /** 1 to 5,000 characters. */
  text: string;
  /** `raw` (the default) or `wav`, with a PCM or G.711 encoding only. */
  container?: TextToSpeechContainer;
  /** MP3 bit rate in bits per second (32000 to 128000, default 64000), with `encoding: "mp3"` only. */
  bit_rate?: number;
};

/** Per-request options of the HTTP client. */
export type SpeechRequestOptions = {
  /**
   * Milliseconds until the request is aborted with a `DOMException` named
   * `TimeoutError`. For `synthesize()` the whole request, 610 000 by default
   * (the response waits for the complete audio; the API caps a request at
   * 600 seconds). For `stream()` the wait for the headers and first audio,
   * 30 000 by default; each later read of the body is bounded by
   * `readTimeout` instead.
   *
   * On Node, the built-in `fetch` also gives up after 300 seconds without
   * response headers (undici's `headersTimeout`), so a `synthesize()` longer
   * than that fails with a `TypeError` first. For longer requests use
   * `stream()`, or raise that limit with
   * `setGlobalDispatcher(new Agent({ headersTimeout: 610_000 }))` from the
   * `undici` package.
   */
  timeout?: number;
  /**
   * For `stream()`: milliseconds a read of the body may wait for audio,
   * 30 000 by default; `0` turns it off. Only the time a read spends waiting
   * counts, so playback at its own pace never trips it. A body that stalls
   * without being reset (a dropped NAT mapping, a hung proxy) then ends with
   * the same retryable `TextToSpeechError` as a cut, and the connection is
   * released.
   */
  readTimeout?: number;
  /**
   * An external abort signal, combined with the timeout. Aborting it rejects
   * the request with the signal's reason; for `stream()` it also stops the
   * download of the body, and the iteration throws that reason. One signal
   * can serve many requests: each detaches from it when it ends.
   */
  signal?: AbortSignal;
};

/** What the response headers of a `200` say about the audio. */
export type SpeechResponseInfo = {
  /** The request's id (`X-Request-Id`). Quote it in support requests. */
  requestId?: string;
  /** The region that served the request, such as `us-east-1`. */
  region?: string;
  /** The model that spoke, such as `assemblyai-tts-1`. */
  model?: string;
  /** The voice that spoke: the request's `voice_id`, or the default voice's slug. */
  voiceId?: string;
  language?: string;
  /** The codec used, in canonical form (`pcm_mulaw`, never `mulaw`). */
  encoding?: string;
  sampleRate?: number;
  /** `raw` or `wav`; absent for MP3. */
  container?: string;
  bitRate?: number;
  /** The response's `Content-Type`, such as `audio/pcm;rate=24000;channels=1`. */
  contentType?: string;
  /** For a cloned voice of the account: its expiry as a Unix time in seconds. */
  voiceExpiresAt?: number;
  /** The characters the request bills. */
  billedCharacters?: number;
  /** The audio's duration in milliseconds, on a complete response. */
  audioDurationMs?: number;
};

/** The result of `synthesize()`: the whole audio, with its headers. */
export type SpeechResponse = SpeechResponseInfo & {
  /** The audio in the requested encoding and container, complete. */
  audio: Uint8Array;
};

/**
 * Parameters of `createTemporaryToken()`. The token is a short-lived
 * credential for a session or an HTTP request made from a user's device:
 * mint a new one for every connection, reconnects included, and for every
 * HTTP request, and keep `expires_in_seconds` short.
 */
export type TextToSpeechTokenParams = {
  /** 1 to 600 seconds the token can wait before it opens a session. */
  expires_in_seconds: number;
  /** At least 60: caps the duration of the session the token opens. */
  max_session_duration_seconds?: number;
};

/** Parameters of a `TextToSpeechSession`. */
export type TextToSpeechSessionParams = {
  /** See `TextToSpeechVoiceOptions.voice_id`. */
  voiceId?: string;
  modelId?: string;
  language?: LiteralUnion<TextToSpeechLanguage, string>;
  /** Defaults to 24000. */
  sampleRate?: TextToSpeechSampleRate;
  /** `pcm_s16le` (default), `pcm_mulaw` or `pcm_alaw`. A session has no MP3 or container. */
  encoding?: LiteralUnion<Exclude<TextToSpeechEncoding, "mp3">, string>;
  /** Whether the server sends `wordBoundaries` events. Off by default here. */
  wordBoundaries?: boolean;
  /** Seconds (5 to 120, default 120) after which an idle session is closed. */
  inactivityTimeout?: number;
  /** `true` renews the consent of the cloned voice in `voiceId` (owner only). */
  extendBiometricConsent?: boolean;
  /**
   * A temporary token, for a session opened on a user's device. It is sent
   * instead of the API key and opens one connection: to reconnect, pass a
   * new token to `connect({ token })`. The API may refuse a token it has
   * already seen, and always refuses an expired one, with close code 1008
   * (`unauthorized`).
   */
  token?: string;
  /** The API key; the client's key is used when neither this nor `token` is given. */
  apiKey?: string;
  /** Defaults to `wss://tts.us.assemblyai.com/v1/ws`; `wss://tts.eu.assemblyai.com/v1/ws` for the EU zone. */
  websocketBaseUrl?: string;
  /** Milliseconds to wait for the handshake and `Begin`. Defaults to 10 000. */
  connectTimeout?: number;
  /**
   * Milliseconds without a message from the API after which `close()` stops
   * waiting for `Termination` and drops the audio still to come; `0` waits
   * indefinitely. Defaults to 35 000, a little over the API's own 30 s limit
   * for a stalled drain.
   */
  terminateTimeout?: number;
};

/** The first frame of a session: it is open and configured. */
export type TtsBeginEvent = {
  type: "Begin";
  /** The session id. Quote it in support requests. */
  id: string;
  /** Unix time in seconds at which the session's maximum duration ends. */
  expires_at: number;
  /** The session as created: effective parameters, `model`, `voice_id`, `limits` and more. */
  configuration: Record<string, unknown>;
};

/** A piece of a request's audio. */
export type TtsAudioEvent = {
  type: "Audio";
  /** Raw codec bytes, decoded from the frame's base64. */
  audio: Uint8Array;
  /** The request the audio belongs to. */
  flush_id: number;
};

/** A request's audio has all been delivered. */
export type TtsFlushDoneEvent = {
  type: "FlushDone";
  flush_id: number;
  /** The playback duration of the request's audio; `0` for nothing to speak. */
  audio_duration_ms: number;
};

export type TtsWord = {
  /** One whitespace-delimited token of the request's text, verbatim. */
  word: string;
  /** Milliseconds on the session's whole audio timeline; subtract `audio_start_ms` for the request's. */
  start: number;
  end: number;
  confidence: number;
};

/** Word timings of a request, best effort, after its `FlushDone`. */
export type TtsWordBoundariesEvent = {
  type: "WordBoundaries";
  flush_id: number;
  /** Where the request's audio starts on the session's timeline. */
  audio_start_ms: number;
  words: TtsWord[];
};

/** The answer to a `Cancel`. */
export type TtsCancelledEvent = {
  type: "Cancelled";
  /** Audio streamed for the cancelled request before it stopped. */
  audio_duration_seconds: number;
};

/** The session's summary, after `Terminate`. */
export type TtsTerminationEvent = {
  type: "Termination";
  session_duration_seconds: number;
  /** The billed characters. */
  total_input_char_length: number;
  audio_duration_seconds: number;
  voice_expires_at?: number | null;
};

/** The frame that precedes a failure close. */
export type TtsErrorMessage = {
  type: "Error";
  /** The WebSocket close code that follows. */
  error_code: number;
  error: string;
  /** The stable cause, such as `voice_not_found` or `rate_limited`. */
  error_type: string;
  retryable: boolean;
  param: string | null;
  retry_after_seconds: number | null;
};

export type TextToSpeechSessionEvents =
  | "begin"
  | "audio"
  | "flushDone"
  | "wordBoundaries"
  | "cancelled"
  | "termination"
  | "error"
  | "close";

export type TextToSpeechSessionListeners = {
  begin?: (event: TtsBeginEvent) => void;
  audio?: (event: TtsAudioEvent) => void;
  flushDone?: (event: TtsFlushDoneEvent) => void;
  wordBoundaries?: (event: TtsWordBoundariesEvent) => void;
  cancelled?: (event: TtsCancelledEvent) => void;
  termination?: (event: TtsTerminationEvent) => void;
  error?: (error: TextToSpeechError) => void;
  close?: (code: number, reason: string) => void;
};
