import { readFile } from "#fs";
import { BaseService } from "../base";
import {
  BaseServiceParams,
  DiarizationAudioInput,
  DiarizationRequest,
  DiarizationRequestOptions,
  DiarizationResponse,
} from "../..";
import { DiarizationError } from "../../utils/errors/diarization";
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
  liveChunks,
  multipartBoundary,
  multipartClosing,
  multipartHead,
  readAsyncIterable,
  resolveFormat,
} from "../../utils/live";

const diarizeEndpoint = "/v1/diarize";
// The extension picks the content type, which picks the server's decoder.
// `.pcm`/`.raw` map to `audio/pcm` inside resolveFormat; unknown extensions
// fall back to `audio/wav`.
const contentTypes: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".webm": "audio/webm",
};
const encoder = new TextEncoder();

/**
 * The Diarization API: audio in, speaker labels out.
 *
 * Posts the audio, and optionally a transcript with word timings, to the
 * client's `diarizationBaseUrl` (`https://diarization.assemblyai.com` by
 * default; `https://diarization.us.assemblyai.com` and
 * `https://diarization.eu.assemblyai.com` keep requests in the US or EU).
 *
 * @example
 * ```ts
 * const transcript = await client.sync.transcribe("./call.wav", { timestamps: true });
 * const { utterances } = await client.diarization.diarize({ audio: "./call.wav", transcript });
 * ```
 */
export class DiarizationService extends BaseService {
  constructor(params: BaseServiceParams) {
    super(params);
  }

  /**
   * Label the speakers in `request.audio`.
   *
   * With `request.transcript`, every word gets a speaker and the response
   * groups them into utterances. Without it, only the model runs:
   * `segments` and `speakers` are filled and `words` and `utterances` are
   * empty.
   * @param request - The audio, and optionally the transcript, config and
   * audio content type.
   * @param options - Client-side options: a deadline and an abort signal.
   * @returns A promise that resolves to the speaker labels.
   * @throws Error when `audio` is a URL, or when raw PCM is missing
   * `sample_rate` or `channels`.
   * @throws DiarizationError when the API refuses the request.
   */
  async diarize(
    request: DiarizationRequest,
    options: DiarizationRequestOptions = {},
  ): Promise<DiarizationResponse> {
    const config = request.config ?? {};
    const { bytes, filename, suffix } = await readAudio(request.audio);
    const format = request.contentType
      ? { filename: filename ?? "audio", contentType: request.contentType }
      : resolveFormat(config, suffix, filename, contentTypes, "config");
    if (
      format.contentType === "audio/pcm" &&
      (config.sample_rate === undefined || config.channels === undefined)
    ) {
      throw new Error(
        "raw PCM audio requires both sample_rate and channels in config",
      );
    }

    const boundary = multipartBoundary();
    const transcriptPart = request.transcript
      ? `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="transcript"\r\n' +
        "Content-Type: application/json\r\n\r\n" +
        // Only `words` is sent: a sync response carries much else.
        JSON.stringify({ words: request.transcript.words }) +
        "\r\n"
      : "";
    // One buffered body rather than a stream: the API requires
    // Content-Length (411 otherwise).
    const body = concatChunks([
      encoder.encode(transcriptPart),
      multipartHead({ boundary, config, ...format }),
      bytes,
      multipartClosing(boundary),
    ]);

    const response = await this.fetchResponse(diarizeEndpoint, {
      method: "POST",
      body,
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      signal:
        options.timeout !== undefined
          ? deadlineSignal(options.timeout, options.signal)
          : options.signal,
    });
    if (response.status !== 200) {
      throw await errorFromResponse(response, DiarizationError, "diarization");
    }
    return (await response.json()) as DiarizationResponse;
  }
}

/**
 * Read any accepted audio input into bytes, with the file name and extension
 * it carries, if any. URLs are rejected: the API has no URL ingestion.
 */
async function readAudio(
  input: DiarizationAudioInput,
): Promise<{ bytes: Uint8Array; filename?: string; suffix: string }> {
  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) {
      throw new Error(
        "DiarizationService does not accept URLs. Pass a local file path, " +
          "audio bytes, a Blob or a stream.",
      );
    }
    if (input.startsWith("data:")) {
      return { bytes: dataUrlToBytes(input), suffix: "" };
    }
    const path = getPath(input) ?? input;
    return named(
      await readAsyncIterable(liveChunks(await readFile(path))),
      path,
    );
  }
  if (input instanceof Uint8Array) return { bytes: input, suffix: "" };
  if (input instanceof ArrayBuffer) {
    return { bytes: new Uint8Array(input), suffix: "" };
  }
  if (input instanceof Blob) {
    // File instances carry a name; the File global itself needs Node >= 20.
    return named(
      new Uint8Array(await input.arrayBuffer()),
      (input as { name?: string }).name,
    );
  }
  if (isWebReadableStream(input) || isIterable(input)) {
    // fs.ReadStream carries the path it was opened from.
    const path = (input as { path?: unknown }).path;
    return named(
      await readAsyncIterable(liveChunks(input)),
      typeof path === "string" ? path : undefined,
    );
  }
  throw new TypeError(`unsupported audio input type: ${describe(input)}`);
}

function named(bytes: Uint8Array, path: string | undefined) {
  const filename = path ? basename(path) : undefined;
  return { bytes, filename, suffix: filename ? extname(filename) : "" };
}
