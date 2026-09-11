/**
 * Audio for a dictation request.
 *
 * The dictation API opens one connection for every shape audio comes in, so
 * this takes both: audio still being produced — an async iterable (Node
 * streams included), a sync iterable, or a web `ReadableStream` of
 * `Uint8Array` chunks — and audio already complete: a local file path or a
 * data URL (file system access requires Node.js, Bun, or Deno), raw bytes,
 * or a Blob/File, which is sent as a single chunk over that same connection.
 *
 * URLs are not accepted — the dictation API has no URL ingestion; use
 * `client.transcripts` for URL or asynchronous transcription.
 */
export type DictationAudioInput =
  | string
  | Uint8Array
  | ArrayBuffer
  | Blob
  | ReadableStream<Uint8Array>
  | NodeJS.ReadableStream
  | AsyncIterable<Uint8Array>
  | Iterable<Uint8Array>;

/**
 * Options for a dictation request.
 *
 * `language_codes`, `stt_prompt` and `keyterms_prompt` shape the transcript;
 * `llm_instruction` asks the server to run a follow-up LLM pass over it, and
 * the rewrite comes back as `DictationResponse.llm_response`. `sample_rate`
 * and `channels` are needed only for raw PCM audio — a WAV container carries
 * them in its own header.
 *
 * These are the only fields sent: the dictation API accepts this exact set,
 * so there is no `model`, `prompt`, `timestamps` or `conversation_context`.
 */
export type DictationConfig = {
  /**
   * The source sample rate in Hz. Setting either this or `channels` marks
   * the audio as raw 16-bit PCM, and both are then required. Leave both
   * unset for WAV, which carries the rate in its own header.
   */
  sample_rate?: number;
  /**
   * The channel count (1 for mono, 2 for stereo). Setting either this or
   * `sample_rate` marks the audio as raw 16-bit PCM, and both are then
   * required. Leave both unset for WAV, which carries the channel count in
   * its own header.
   */
  channels?: number;
  /**
   * ISO 639-1 codes for the language(s) of the audio — a single-element
   * array (e.g. `["es"]`) for monolingual audio, or several codes (e.g.
   * `["en", "es"]`) for multilingual audio. Unset leaves the language to the
   * server's default.
   */
  language_codes?: string[];
  /**
   * Context for the transcription: a description of what the audio is about,
   * e.g. `"A doctor dictating a patient visit note."`. It describes the
   * situation rather than instructing the model, and steers the decoder as it
   * writes the transcript — where `llm_instruction` reshapes the transcript
   * afterwards. Maximum 4096 characters; longer prompts are rejected.
   */
  stt_prompt?: string;
  /**
   * Terms to bias the decoder towards. Whitespace is stripped and empty terms
   * are dropped. Maximum 2048 characters in total — longer lists are
   * rejected.
   */
  keyterms_prompt?: string[];
  /**
   * Instruction for a follow-up LLM pass over the transcript, e.g.
   * `"Format this as a SOAP note."`. The rewritten text comes back as
   * `llm_response`; the raw transcript stays in `text`. Maximum 2048
   * characters; longer instructions are rejected.
   */
  llm_instruction?: string;
};

/**
 * Client-side options for a dictation request. These are not sent to the
 * server.
 */
export type DictationLiveOptions = {
  /**
   * The total request deadline in milliseconds, measured from the start of
   * the request: it spans the upload, the transcription and the LLM pass.
   * Defaults to 300 000, matching the service's total request budget. The
   * audio itself is capped at 120 seconds.
   */
  timeout?: number;
  /**
   * An `AbortSignal` that drops the request when aborted. `openLive()`
   * sessions manage their own; pass one here to cancel a `transcribeLive()`
   * call from outside.
   */
  signal?: AbortSignal;
};

/**
 * A single word in a dictation transcript.
 */
export type DictationWord = {
  /** The text of the word. */
  text: string;
  /** The confidence score of the word, in the range 0-1. */
  confidence: number;
};

/**
 * The result of a dictation request.
 */
export type DictationResponse = {
  /** The raw transcript text, before any LLM pass. */
  text: string;
  /** Per-word text and confidence. */
  words: DictationWord[];
  /** The overall transcript confidence, in the range 0-1. */
  confidence: number;
  /**
   * The transcript rewritten by the LLM pass `llm_instruction` asked for.
   * `null` when no instruction was sent or the pass failed.
   */
  llm_response?: string | null;
  /** Why the LLM pass failed, when it did. `null` otherwise. */
  llm_error?: string | null;
  /** The total audio duration in milliseconds. */
  audio_duration_ms: number;
  /**
   * The server-generated UUID for this request. Record it to correlate a
   * request with support.
   */
  session_id: string;
  /**
   * The end-to-end server-side request time in milliseconds: auth, multipart
   * parse, decode, inference, the LLM pass, and serialization.
   */
  request_time_ms?: number;
  /**
   * The time in milliseconds spent transcribing, excluding the LLM pass.
   */
  sync_time_ms?: number;
  /**
   * The text to show the user: `llm_response` when the LLM pass produced one,
   * `text` otherwise. Derived by the SDK from those two fields, so reading it
   * is safe whether or not an `llm_instruction` was sent.
   */
  final_text: string;
};
