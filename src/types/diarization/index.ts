/**
 * Audio for a diarization request: a local file path or data URL (file
 * system access requires Node.js, Bun, or Deno), raw audio bytes, a
 * Blob/File, or a readable stream. The audio is read whole before the request
 * is sent, since the API needs its length up front.
 *
 * URLs are not accepted — the diarization API has no URL ingestion.
 */
export type DiarizationAudioInput =
  | string
  | Uint8Array
  | ArrayBuffer
  | Blob
  | ReadableStream<Uint8Array>
  | NodeJS.ReadableStream;

/**
 * One word of the transcript to label. Times are in milliseconds.
 *
 * A `SyncWord` from `client.sync.transcribe()` fits as is; request the sync
 * transcript with `timestamps: true` so its words carry timings.
 */
export type DiarizationTranscriptWord = {
  /** The text of the word. */
  text: string;
  /**
   * The start time of the word in milliseconds. A word without timings takes
   * them from the words next to it; if no word has timings the request fails.
   */
  start?: number;
  /** The end time of the word in milliseconds. */
  end?: number;
  /** The confidence score of the word, in the range 0-1. */
  confidence?: number;
};

/**
 * The transcript whose words get speaker labels. Only `words` is sent, so a
 * `SyncTranscriptResponse` from `client.sync.transcribe()` can be passed
 * straight through.
 */
export type DiarizationTranscript = {
  /**
   * The words to label. An empty list skips the model and returns empty
   * lists.
   */
  words: DiarizationTranscriptWord[];
};

/**
 * Options for a diarization request. These are the only fields the API
 * accepts; any other field is rejected with a 400.
 */
export type DiarizationConfig = {
  /**
   * The source sample rate in Hz. Setting either this or `channels` marks
   * the audio as raw 16-bit PCM, and both are then required. Leave both
   * unset for WAV and compressed formats, which carry them in their headers.
   */
  sample_rate?: number;
  /**
   * The channel count. Setting either this or `sample_rate` marks the audio
   * as raw 16-bit PCM, and both are then required.
   */
  channels?: number;
  /**
   * A bare language code such as `"en"` or `"es"` (not `"en-US"`). It
   * decides whether the words of one sentence are voted onto one speaker.
   * Defaults to `"en"`; unused without a transcript.
   */
  language_code?: string;
};

/**
 * A diarization request.
 */
export type DiarizationRequest = {
  /** The audio to diarize. */
  audio: DiarizationAudioInput;
  /**
   * The transcript to label, with word timings in milliseconds. Leave it out
   * to diarize the audio alone: the response then has empty `words` and
   * `utterances`, and `segments` and `speakers` filled.
   */
  transcript?: DiarizationTranscript;
  /** Options for the request. */
  config?: DiarizationConfig;
  /**
   * The audio part's content type, which picks the server's decoder:
   * `audio/wav`, `audio/pcm` (needs `config.sample_rate` and
   * `config.channels`), `audio/mpeg`, `audio/flac`, `audio/ogg`, `audio/mp4`
   * or `audio/webm`. Inferred from the file extension when unset, and
   * `audio/wav` when there is none.
   */
  contentType?: string;
};

/**
 * Client-side options for a diarization request. These are not sent to the
 * server.
 */
export type DiarizationRequestOptions = {
  /**
   * The request deadline in milliseconds, spanning the upload and the
   * diarization. No deadline when unset.
   */
  timeout?: number;
  /** An `AbortSignal` that drops the request when aborted. */
  signal?: AbortSignal;
};

/** A transcript word with its speaker. Times are in milliseconds. */
export type DiarizationWord = {
  text: string;
  start: number;
  end: number;
  confidence?: number;
  /** The speaker label: `A`, `B`, and so on. */
  speaker: string;
  /** The calibrated confidence of the speaker label; absent when unavailable. */
  speaker_confidence?: number;
};

/** A run of consecutive words by one speaker. */
export type DiarizationUtterance = {
  speaker: string;
  start: number;
  end: number;
  /** The words' text, joined. */
  text: string;
  /** The mean word confidence. */
  confidence: number;
  /** The mean word `speaker_confidence`; absent unless every word has one. */
  speaker_confidence?: number;
  words: DiarizationWord[];
};

/** One of the model's speaker turns. Times are in milliseconds. */
export type DiarizationSegment = {
  start: number;
  end: number;
  speaker: string;
  /** The segment's calibrated confidence; absent when unavailable. */
  speaker_confidence?: number;
};

/**
 * The result of a diarization request.
 *
 * A label means the same speaker in `words` and `segments`. `speakers` lists
 * only the speakers words went to (all speakers, in order of first
 * appearance, without a transcript), so a segment can carry a label that is
 * not in it.
 */
export type DiarizationResponse = {
  /** The transcript's words with speakers; empty without a transcript. */
  words: DiarizationWord[];
  /** Runs of consecutive words by one speaker; empty without a transcript. */
  utterances: DiarizationUtterance[];
  /** The speaker labels, sorted. */
  speakers: string[];
  /** The model's speaker turns, sorted by start. */
  segments: DiarizationSegment[];
  /** The audio duration in milliseconds. */
  audio_duration_ms: number;
  /** The server-generated id for this request; record it for support. */
  session_id: string;
  /** The server-side request time in milliseconds. */
  request_time_ms: number;
};
