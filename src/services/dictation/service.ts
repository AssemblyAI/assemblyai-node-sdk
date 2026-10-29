import { readFile } from "#fs";
import { BaseService } from "../base";
import {
  BaseServiceParams,
  DictationAudioInput,
  DictationConfig,
  DictationLiveOptions,
  DictationResponse,
} from "../..";
import { DictationError } from "../../utils/errors/dictation";
import { getPath } from "../../utils/path";
import {
  basename,
  concatChunks,
  dataUrlToBytes,
  deadlineSignal,
  describe,
  errorFromResponse,
  extname,
  isIterable,
  isWebReadableStream,
  liveBody,
  liveChunks,
  multipartBoundary,
  multipartClosing,
  multipartHead,
  readStream,
  resolveFormat,
} from "../../utils/live";
import { DictationLiveSession } from "./live";
import { AudioRecording } from "./recording";

// The endpoint this service posts audio to; the dictation API serves it under
// /v1 only. It caps a request at 120 s of audio.
const transcribeLiveEndpoint = "/v1/transcribe/live";
// The buffered endpoint: the whole recording in one body, up to 20 minutes or
// 256 MB. Used only by the fallback, once the live endpoint has refused a
// dictation for running past its cap.
const transcribeBufferedEndpoint = "/v1/transcribe";
const warmEndpoint = "/v1/warm";
// A fetch deadline spans the whole request, so this covers the upload, the
// transcription and the LLM pass together. It matches the service's own
// total request budget; the live audio itself is capped at 120 s. A buffered
// fallback request gets a fresh deadline of the same length.
const defaultLiveTimeoutMs = 300_000;
const warmTimeoutMs = 10_000;
// Caps mirror the dictation service's `config` part; a field over its cap is
// rejected before any request is sent.
const maxSttPromptLength = 6000;
const maxKeytermsPromptLength = 8000;
const maxKeytermsCount = 100;
const maxLlmInstructionLength = 2048;
// What to call the config in the message when raw PCM is missing a field.
const configName = "the config";
// The extension picks the content type that tells the server which decoder
// to use. The live route accepts WAV and PCM; a compressed format is posted
// with its true type so the server's rejection names it, rather than being
// mislabelled as WAV.
const contentTypes: Record<string, string> = {
  ".wav": "audio/wav",
  ".pcm": "audio/pcm",
  ".raw": "audio/pcm",
  ".mp3": "audio/mpeg",
  ".aac": "audio/aac",
  ".mp4": "audio/mp4",
  ".m4a": "audio/x-m4a",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};

/**
 * The dictation service: a short spoken note in, a transcript out.
 *
 * Tuned for dictation — someone speaks a note and wants it back as text,
 * optionally cleaned up or reformatted. The audio is uploaded while it is
 * still being spoken, from a callback with `openLive()` or from a stream with
 * `transcribeLive()`, so the upload and every speech segment but the last are
 * done by the time the speaker stops. Audio already held whole — bytes, a
 * Blob, a local path — goes to `transcribeLive()` too and travels the same
 * connection as a single chunk: there is one request shape here. The one
 * exception is a dictation that runs past the live endpoint's 120 s cap,
 * which by default is sent again whole to the buffered endpoint (see
 * `DictationLiveOptions.fallbackToBuffered`).
 *
 * Unlike `client.transcripts`, which submits a job to the async API and polls
 * for completion, there is no job id, no status to poll and no URL ingestion.
 * Beyond the transcript it can run a follow-up LLM pass: set
 * `llm_instruction` on the config and read `final_text` off the result.
 *
 * Requests go to the dictation API (`dictation.assemblyai.com`), which the
 * `dictationBaseUrl` client option overrides.
 */
export class DictationTranscriber extends BaseService {
  /**
   * Create a new dictation service.
   * @param params - The parameters to use for the service.
   */
  constructor(params: BaseServiceParams) {
    super(params);
  }

  /**
   * Transcribe dictated audio, uploading it as it is produced.
   *
   * Starts the request immediately and uploads chunks as they arrive, so
   * authorization, the upload and every speech segment but the last resolve
   * while the speaker is still talking. What is left to wait for once they
   * stop is the final segment, and the LLM pass if one was asked for. Audio
   * that is already complete — bytes, a Blob, a local path — is accepted as
   * well and sent as a single chunk over the same connection.
   *
   * A producer must keep producing: an upload that goes silent for long
   * enough is aborted server-side, so stop by ending the stream rather than
   * pausing it. For sources that deliver audio through a callback rather than
   * a stream, see `openLive()`.
   *
   * The live endpoint caps a request at 120 s of audio. Past it, by default,
   * the SDK falls back to the buffered endpoint: it keeps reading the source
   * until it ends, then posts the whole recording once to `/v1/transcribe`
   * (up to 20 minutes or 256 MB) and resolves with that result. A fallback
   * result waits for the whole recording to upload and be transcribed, so a
   * long dictation returns more slowly than a live one. Set
   * `options.fallbackToBuffered` to `false` to get the 413 instead; see
   * `DictationLiveOptions.fallbackToBuffered` for the memory the copy costs.
   * @param audio - Audio still being produced (an async iterable, Node
   * streams included; a sync iterable; a web `ReadableStream`) or audio held
   * whole (a local file path, a data URL, raw bytes, a Blob). Raw PCM also
   * requires `sample_rate` and `channels` on the config.
   * @param config - Options for this dictation request.
   * @param options - Client-side options: the request deadline, an optional
   * abort signal, and whether to fall back to the buffered endpoint past the
   * live cap.
   * @returns A promise that resolves to the finished transcript, whose
   * `final_text` carries the LLM rewrite when one was asked for.
   * @throws Error when `audio` is a URL, or when raw PCM is missing
   * `sample_rate` or `channels`.
   * @throws TypeError when `audio` is of an unsupported type, or when a
   * produced chunk is not bytes.
   * @throws DictationError when the request fails. Auth, rate-limit, size and
   * capacity failures can surface part-way through the upload. After a
   * fallback, the error is the buffered request's own (a 413 past 20 minutes
   * or 256 MB, say). Anything the producer throws propagates unchanged; the
   * connection is dropped.
   * @example
   * ```ts
   * const result = await client.dictation.transcribeLive(mic, {
   *   sample_rate: 16000,
   *   channels: 1,
   *   llm_instruction: "Format this as a SOAP note.",
   * });
   * console.log(result.final_text);
   * ```
   */
  async transcribeLive(
    audio: DictationAudioInput,
    config: DictationConfig = {},
    options: DictationLiveOptions = {},
  ): Promise<DictationResponse> {
    const source = await resolveSource(audio);
    const { filename, contentType } = resolveFormat(
      config,
      source.suffix,
      source.filename,
      contentTypes,
      configName,
    );
    return await this.transcribe(
      source.chunks,
      filename,
      contentType,
      config,
      options,
    );
  }

  /**
   * Open a dictation that audio is pushed into.
   *
   * The push-style counterpart of `transcribeLive()`, for sources that
   * deliver audio through a callback rather than a stream. The request starts
   * immediately; call `session.write(chunk)` from the callback, then
   * `await session.result()` for the transcript once the speaker stops. See
   * `DictationLiveSession`.
   *
   * Past the live endpoint's 120 s cap the session falls back to the
   * buffered endpoint, as `transcribeLive()` does: it keeps taking writes
   * until `close()` or `result()`, then posts the whole recording once, and
   * `result()` resolves with that transcript — more slowly than a live one,
   * since it waits for the whole recording to upload and be transcribed.
   * `abort()` still drops everything, with no fallback request.
   * @param config - Options for this dictation request. Raw PCM requires
   * `sample_rate` and `channels`.
   * @param options - Client-side options: the request deadline, which must
   * cover the live part of the dictation, and whether to fall back to the
   * buffered endpoint past the live cap. The session manages its own abort
   * signal; use `session.abort()`.
   * @returns The open session.
   * @example
   * ```ts
   * const session = client.dictation.openLive({ sample_rate: 16000, channels: 1 });
   * mic.on("data", (chunk) => session.write(chunk));
   * mic.on("end", () => session.close());
   * const { final_text } = await session.result();
   * ```
   */
  openLive(
    config: DictationConfig = {},
    options: DictationLiveOptions = {},
  ): DictationLiveSession {
    return new DictationLiveSession(async (chunks, abortSignal) => {
      // A pushed session has no source to name, so the audio part takes the
      // default name and the content type the config implies.
      const { filename, contentType } = resolveFormat(
        config,
        "",
        undefined,
        contentTypes,
        configName,
      );
      return await this.transcribe(chunks, filename, contentType, config, {
        timeout: options.timeout,
        fallbackToBuffered: options.fallbackToBuffered,
        signal: abortSignal,
      });
    });
  }

  /**
   * Run one dictation: the live request, and the buffered fallback when the
   * live endpoint refuses the audio for running past its cap.
   *
   * With the fallback on, a copy of every audio byte the live upload reads is
   * kept. When the live request fails with 413 `audio_too_large` — mid-upload
   * or after the body was sent — the source is read on to its end (that is
   * still recording time, so the live deadline no longer applies; the abort
   * signal does), and the whole copy is posted once to the buffered
   * endpoint under a fresh deadline. Every other outcome is the live
   * request's own, and with the fallback off no copy is kept at all.
   */
  private async transcribe(
    chunks: AsyncIterable<Uint8Array>,
    filename: string,
    contentType: string,
    config: DictationConfig,
    options: DictationLiveOptions,
  ): Promise<DictationResponse> {
    const configJson = buildConfigJson(config);
    const timeoutMs = options.timeout ?? defaultLiveTimeoutMs;
    const format = { configJson, filename, contentType };
    if (options.fallbackToBuffered === false) {
      return await this.postLive(
        chunks,
        format,
        deadlineSignal(timeoutMs, options.signal),
      );
    }

    const recording = new AudioRecording(chunks);
    try {
      // A 200 arrives once the whole body was sent, so the source has ended.
      return await this.postLive(
        recording.chunks,
        format,
        deadlineSignal(timeoutMs, options.signal),
      );
    } catch (error) {
      if (!isAudioTooLarge(error)) {
        // Exactly what the live request does on its own: stop the producer
        // and report the failure.
        recording.release();
        throw error;
      }
    }

    // The live endpoint refused the dictation for its length. The live
    // upload has stopped reading; read the rest of the recording here, up to
    // key-up, then send all of it at once.
    await recording.drain(options.signal);
    return await this.postBuffered(
      recording.take(),
      format,
      deadlineSignal(timeoutMs, options.signal),
    );
  }

  /**
   * Post a dictation request whose audio arrives from `chunks`.
   *
   * The body is a chunked multipart stream, so the request can start before
   * the audio exists: the `config` part goes out first, then each chunk as it
   * is produced, then the terminating boundary.
   */
  private async postLive(
    chunks: AsyncIterable<Uint8Array>,
    format: AudioFormat,
    signal: AbortSignal,
  ): Promise<DictationResponse> {
    const boundary = multipartBoundary();
    const body = liveBody({
      head: multipartHead({
        boundary,
        config: format.configJson,
        filename: format.filename,
        contentType: format.contentType,
      }),
      chunks,
      closing: multipartClosing(boundary),
    });

    let response: Response;
    try {
      response = await this.fetchResponse(transcribeLiveEndpoint, {
        method: "POST",
        body: body.stream,
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        // Required by fetch for a streaming request body; it is what lets the
        // request start before the audio exists.
        duplex: "half",
        signal,
      } as RequestInit);
    } catch (error) {
      // fetch reports a failed request body as an opaque "fetch failed";
      // surface what the producer actually threw.
      throw body.error ?? error;
    }
    if (response.status !== 200) {
      // The server can reject while the upload is still in flight (auth,
      // rate limit, size, capacity). fetch resolves with the status at once
      // but withholds the response body until the request body ends, so end
      // it now rather than streaming the rest of a rejected dictation. With
      // the buffered fallback on, this only stops the upload: the source
      // stays open, for the fallback to read to its end.
      body.finish();
    }
    return await dictationResult(response);
  }

  /**
   * Post a whole recording to the buffered endpoint in one request: the same
   * `config` part and audio part as the live request, with the audio already
   * complete.
   * @param audio - The recorded chunks, in order. Emptied here once they are
   * copied into the body, so the recording is held once, not twice, while
   * the request is in flight.
   */
  private async postBuffered(
    audio: Uint8Array[],
    format: AudioFormat,
    signal: AbortSignal,
  ): Promise<DictationResponse> {
    const boundary = multipartBoundary();
    const body = concatChunks([
      multipartHead({
        boundary,
        config: format.configJson,
        filename: format.filename,
        contentType: format.contentType,
      }),
      ...audio,
      multipartClosing(boundary),
    ]);
    audio.length = 0;
    const response = await this.fetchResponse(transcribeBufferedEndpoint, {
      method: "POST",
      body,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      signal,
    });
    return await dictationResult(response);
  }

  /**
   * Open the connection to the dictation API ahead of time.
   *
   * A request that opens its connection on demand pays the full DNS + TCP +
   * TLS handshake before the first audio byte can leave — one network round
   * trip that, for a distant client, is a noticeable share of a short
   * dictation. Call `warm()` as soon as you know audio is coming — when the
   * user reaches for the record button, say — and the next request reuses the
   * already-open connection. It is idempotent and cheap, so calling it again
   * to refresh the connection is fine; call it shortly before the request,
   * since the pooled connection idles out after a few seconds.
   * @returns A promise that resolves to `true` once the connection is open
   * (any HTTP response — even a non-200 — means the socket is established),
   * or `false` if the connection could not be opened.
   */
  async warm(): Promise<boolean> {
    try {
      await this.fetchResponse(warmEndpoint, {
        method: "GET",
        signal: AbortSignal.timeout(warmTimeoutMs),
      });
      return true;
    } catch {
      return false;
    }
  }
}

/** What a request's `config` and `audio` parts carry besides the audio. */
type AudioFormat = {
  configJson: Record<string, unknown>;
  filename: string;
  contentType: string;
};

/**
 * Read a dictation response: the transcript on a 200, a `DictationError`
 * otherwise. Live and buffered requests answer in the same shape.
 * @param response - The response; its body is read here.
 * @returns The transcript, with `final_text` derived.
 * @throws DictationError when the status is not 200.
 */
async function dictationResult(response: Response): Promise<DictationResponse> {
  if (response.status !== 200) {
    throw await errorFromResponse(
      response,
      DictationError,
      "dictation transcription",
    );
  }
  const json = (await response.json()) as DictationResponse;
  // The LLM rewrite is the text to show when there is one; a pass that was
  // never asked for, or that failed, leaves `llm_response` null.
  return { ...json, final_text: json.llm_response ?? json.text };
}

/**
 * Whether a failed live request is the one the buffered fallback answers:
 * the live endpoint's 413 for audio past its 120 s cap. Any other 413 (a
 * body too large in bytes, say) and every other failure is not.
 * @param error - What the live request threw.
 * @returns `true` for a 413 with error code `audio_too_large`.
 */
function isAudioTooLarge(error: unknown): boolean {
  return (
    error instanceof DictationError &&
    error.status === 413 &&
    error.errorCode === "audio_too_large"
  );
}

type ResolvedSource = {
  chunks: AsyncIterable<Uint8Array>;
  filename?: string;
  suffix: string;
};

/**
 * Turn any accepted audio input into chunks for the upload, and pick up the
 * file name and extension the audio part should carry.
 *
 * Audio that is already complete — bytes, a Blob, a data URL, or a local
 * path, which is read here — becomes a single chunk. A stream or iterable is
 * drained as the upload proceeds. URLs are rejected: the dictation API has no
 * URL ingestion.
 */
async function resolveSource(
  input: DictationAudioInput,
): Promise<ResolvedSource> {
  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) {
      throw new Error(
        "DictationTranscriber does not accept URLs. Pass a local file path, " +
          "audio bytes, a Blob or a stream of audio chunks, or use " +
          "client.transcripts for URL transcription.",
      );
    }
    if (input.startsWith("data:")) {
      return { chunks: singleChunk(dataUrlToBytes(input)), suffix: "" };
    }
    const path = getPath(input) ?? input;
    const filename = basename(path);
    return {
      chunks: singleChunk(await readStream(await readFile(path))),
      filename,
      suffix: extname(filename),
    };
  }
  if (input instanceof Uint8Array) {
    return { chunks: singleChunk(input), suffix: "" };
  }
  if (input instanceof ArrayBuffer) {
    return { chunks: singleChunk(new Uint8Array(input)), suffix: "" };
  }
  if (input instanceof Blob) {
    const bytes = new Uint8Array(await input.arrayBuffer());
    // File instances carry a name; the File global itself needs Node >= 20.
    const name = (input as { name?: string }).name;
    const filename = name ? basename(name) : undefined;
    return {
      chunks: singleChunk(bytes),
      filename,
      suffix: filename ? extname(filename) : "",
    };
  }
  if (isWebReadableStream(input) || isIterable(input)) {
    // fs.ReadStream carries the path it was opened from.
    const path = (input as { path?: string | Buffer }).path;
    const filename = typeof path === "string" ? basename(path) : undefined;
    return {
      chunks: liveChunks(input),
      filename,
      suffix: filename ? extname(filename) : "",
    };
  }
  throw new TypeError(`unsupported audio input type: ${describe(input)}`);
}

/** Presents audio that is already complete as the upload's one chunk. */
async function* singleChunk(bytes: Uint8Array): AsyncGenerator<Uint8Array> {
  yield bytes;
}

/**
 * Serialize the config to the JSON `config` part, validating and normalizing
 * field values to match the server's caps. Only the fields the dictation API
 * accepts are sent; an empty object goes out when nothing is set, since the
 * route requires the part ahead of the audio.
 * @param config - The options for this request.
 * @returns The JSON-ready config part.
 * @throws Error when a field exceeds its cap.
 */
function buildConfigJson(config: DictationConfig): Record<string, unknown> {
  if (
    config.stt_prompt !== undefined &&
    config.stt_prompt.length > maxSttPromptLength
  ) {
    throw new Error(
      `stt_prompt exceeds ${maxSttPromptLength} characters (got ${config.stt_prompt.length})`,
    );
  }
  if (
    config.llm_instruction !== undefined &&
    config.llm_instruction.length > maxLlmInstructionLength
  ) {
    throw new Error(
      `llm_instruction exceeds ${maxLlmInstructionLength} characters (got ${config.llm_instruction.length})`,
    );
  }

  const json: Record<string, unknown> = {};
  if (config.sample_rate !== undefined)
    json["sample_rate"] = config.sample_rate;
  if (config.channels !== undefined) json["channels"] = config.channels;
  if (config.language_codes !== undefined)
    json["language_codes"] = config.language_codes;
  if (config.stt_prompt !== undefined) json["stt_prompt"] = config.stt_prompt;
  const keytermsPrompt = normalizeKeytermsPrompt(config.keyterms_prompt);
  if (keytermsPrompt) json["keyterms_prompt"] = keytermsPrompt;
  if (config.llm_instruction !== undefined)
    json["llm_instruction"] = config.llm_instruction;
  if (config.rewrite_mode !== undefined)
    json["rewrite_mode"] = config.rewrite_mode;

  return json;
}

function normalizeKeytermsPrompt(
  keytermsPrompt?: string[],
): string[] | undefined {
  if (!keytermsPrompt) return undefined;
  const terms = keytermsPrompt
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
  if (terms.length > maxKeytermsCount) {
    throw new Error(
      `keyterms_prompt exceeds ${maxKeytermsCount} terms (got ${terms.length})`,
    );
  }
  const total = terms.reduce((sum, term) => sum + term.length, 0);
  if (total > maxKeytermsPromptLength) {
    throw new Error(
      `keyterms_prompt exceeds ${maxKeytermsPromptLength} characters (got ${total})`,
    );
  }
  return terms.length > 0 ? terms : undefined;
}
