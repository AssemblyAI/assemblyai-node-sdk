import { LiteralUnion } from "../helpers";

/**
 * The speech models available on the synchronous transcription API.
 */
export type SyncSpeechModel = LiteralUnion<"universal-3-5-pro", string>;

/**
 * The default speech model for synchronous transcription.
 */
export const defaultSyncSpeechModel: SyncSpeechModel = "universal-3-5-pro";

/**
 * Audio input for synchronous transcription: a local file path or
 * data URL (file system access requires Node.js, Bun, or Deno), raw audio
 * bytes, a Blob/File, or a readable stream.
 *
 * URLs are not accepted — the sync API has no URL ingestion; use
 * `client.transcripts` for URL or asynchronous transcription.
 */
export type SyncAudioInput =
  | string
  | Uint8Array
  | ArrayBuffer
  | Blob
  | ReadableStream<Uint8Array>
  | NodeJS.ReadableStream;

/**
 * Options for a synchronous transcription request.
 *
 * `sample_rate` and `channels` are required only for raw PCM audio — WAV
 * carries them in its header. `model` is sent as the `X-AAI-Model` routing
 * header and is never included in the request body.
 */
export type SyncTranscriptionConfig = {
  /**
   * The sync speech model to route to, sent as the `X-AAI-Model` header.
   * Defaults to `"universal-3-5-pro"`.
   */
  model?: SyncSpeechModel;
  /**
   * Custom transcription instruction. Maximum 4096 characters — longer
   * prompts are rejected.
   */
  prompt?: string;
  /**
   * Terms to bias the decoder towards. Whitespace is stripped and empty
   * terms are dropped. Maximum 2048 characters in total — longer lists are
   * rejected.
   */
  keyterms_prompt?: string[];
  /**
   * Prior turns from the same conversation, oldest first, most recent last.
   * A single string is treated as one turn. Capped at 100 turns and 4096
   * characters in total — over-cap context is trimmed (oldest turns dropped
   * first), not rejected.
   */
  conversation_context?: string | string[];
  /**
   * ISO 639-1 codes for the language(s) of the audio — a single-element
   * array (e.g. `["es"]`) for monolingual audio, or several codes (e.g.
   * `["en", "es"]`) for multilingual audio. Ignored when `prompt` is set.
   * Defaults to English.
   */
  language_codes?: string[];
  /**
   * The source sample rate in Hz. Required for raw PCM audio; ignored for
   * WAV.
   */
  sample_rate?: number;
  /**
   * The channel count (1 for mono, 2 for stereo). Required for raw PCM
   * audio; ignored for WAV.
   */
  channels?: number;
  /**
   * Whether to compute per-word `start`/`end` timestamps. When `true`,
   * words carry accurate timestamps at a small latency cost. Defaults to
   * `false`: no timestamps are returned.
   */
  timestamps?: boolean;
};

/**
 * Client-side options for a synchronous transcription request.
 * These are not sent to the server.
 */
export type SyncTranscribeOptions = {
  /**
   * The request timeout in milliseconds. Defaults to 60 000, which is kept
   * above the server's 30 s deadline so the client doesn't race it.
   */
  timeout?: number;
};

/**
 * A single word in a sync transcript.
 *
 * `start`/`end` are in milliseconds and present only when the request set
 * `timestamps: true`; otherwise they are omitted.
 */
export type SyncWord = {
  /** The text of the word. */
  text: string;
  /**
   * The start time of the word in milliseconds. Absent unless `timestamps`
   * was requested.
   */
  start?: number;
  /**
   * The end time of the word in milliseconds. Absent unless `timestamps`
   * was requested.
   */
  end?: number;
  /** The confidence score of the word, in the range 0-1. */
  confidence: number;
};

/**
 * The result of a synchronous transcription request.
 */
export type SyncTranscriptResponse = {
  /** The full transcript text. */
  text: string;
  /**
   * Per-word confidence, plus `start`/`end` timings when the request set
   * `timestamps: true`.
   */
  words: SyncWord[];
  /** The overall transcript confidence, in the range 0-1. */
  confidence: number;
  /** The total audio duration in milliseconds. */
  audio_duration_ms: number;
  /**
   * The server-generated UUID for this request. Record it to correlate a
   * request with support.
   */
  session_id: string;
  /**
   * The end-to-end server-side request time in milliseconds. `undefined`
   * when the server predates the field.
   */
  request_time_ms?: number;
};
