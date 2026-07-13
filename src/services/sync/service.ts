import { readFile } from "#fs";
import { BaseService } from "../base";
import {
  BaseServiceParams,
  SyncAudioInput,
  SyncTranscribeOptions,
  SyncTranscriptResponse,
  SyncTranscriptionConfig,
} from "../..";
import { defaultSyncSpeechModel } from "../../types/sync";
import { SyncTranscriptError } from "../../utils/errors/sync";
import { getPath } from "../../utils/path";

// Canonical paths since the sync API gained a /v1 prefix (#18103); the
// unprefixed routes remain served for SDK versions that predate it.
const transcribeEndpoint = "/v1/transcribe";
const warmEndpoint = "/v1/warm";
const modelHeader = "X-AAI-Model";
// Kept above the server's 30 s deadline so the client doesn't race it.
const defaultTimeoutMs = 60_000;
const warmTimeoutMs = 10_000;
const maxPromptLength = 4096;
const maxKeytermsPromptLength = 2048;
const maxContextTurns = 100;
const maxContextLength = 4096;
// Extensions that signal raw S16LE PCM rather than a WAV container.
const pcmSuffixes = [".pcm", ".raw"];

/**
 * The synchronous transcription service: audio in, transcript out,
 * one request.
 *
 * Unlike `client.transcripts` (which submits a job to the async API and
 * polls for completion), `SyncTranscriber` posts the audio to the sync
 * API and returns the finished transcript in the HTTP response. There is no
 * job id or status to poll. Accepts a local file path, raw audio bytes, a
 * Blob, or a readable stream — but not a URL.
 */
export class SyncTranscriber extends BaseService {
  /**
   * Create a new synchronous transcription service.
   * @param params - The parameters to use for the service.
   */
  constructor(params: BaseServiceParams) {
    super(params);
  }

  /**
   * Transcribe audio and return the finished transcript in one request.
   * @param audio - A local file path, raw audio bytes, a Blob, or a readable
   * stream. Raw PCM also requires `sample_rate` and `channels` on the config.
   * @param config - Options for this transcription request.
   * @param options - Client-side options, such as the request timeout.
   * @returns A promise that resolves to the finished transcript.
   * @throws SyncTranscriptError when the request fails.
   */
  async transcribe(
    audio: SyncAudioInput,
    config: SyncTranscriptionConfig = {},
    options: SyncTranscribeOptions = {},
  ): Promise<SyncTranscriptResponse> {
    const { bytes, filename, contentType } = await resolveAudio(audio, config);

    const body = new FormData();
    body.append(
      "audio",
      new Blob([bytes as BlobPart], { type: contentType }),
      filename,
    );
    const configJson = buildConfigJson(config);
    if (configJson) {
      body.append(
        "config",
        new Blob([JSON.stringify(configJson)], { type: "application/json" }),
      );
    }

    const response = await this.fetchResponse(transcribeEndpoint, {
      method: "POST",
      body,
      headers: { [modelHeader]: config.model ?? defaultSyncSpeechModel },
      signal: AbortSignal.timeout(options.timeout ?? defaultTimeoutMs),
    });
    if (response.status !== 200) throw await errorFromResponse(response);
    return (await response.json()) as SyncTranscriptResponse;
  }

  /**
   * Open the connection to the sync API ahead of time.
   *
   * The sync API is a single request/response, so a `transcribe()` that
   * opens its connection on demand pays the full DNS + TCP + TLS handshake
   * on the critical path. Call `warm()` as soon as you know audio is coming —
   * typically while the clip is still being recorded — so the next
   * `transcribe()` reuses the already-open connection. `warm()` is idempotent
   * and cheap; call it shortly before `transcribe()` so the pooled connection
   * hasn't idled out.
   * @param params - Optionally the model to route the probe to, so the warmed
   * connection lands on the same backend as the eventual transcription.
   * @returns A promise that resolves to `true` once the connection is open
   * (any HTTP response — even a non-200 — means the socket is
   * established), or `false` if the connection could not be opened.
   */
  async warm(params?: { model?: string }): Promise<boolean> {
    try {
      await this.fetchResponse(warmEndpoint, {
        method: "GET",
        headers: { [modelHeader]: params?.model ?? defaultSyncSpeechModel },
        signal: AbortSignal.timeout(warmTimeoutMs),
      });
      return true;
    } catch {
      return false;
    }
  }
}

type ResolvedAudio = {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
};

/**
 * Read the audio input into bytes and decide its multipart content type.
 *
 * PCM is selected when the source has a `.pcm`/`.raw` extension or when
 * `sample_rate`/`channels` are set on the config (the fields the sync API
 * requires only for raw PCM) — and both must then be present. Everything
 * else is treated as a WAV container. URLs are rejected — the sync API has
 * no URL ingestion.
 */
async function resolveAudio(
  input: SyncAudioInput,
  config: SyncTranscriptionConfig,
): Promise<ResolvedAudio> {
  let bytes: Uint8Array;
  let filename: string | undefined;
  let suffix = "";

  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) {
      throw new Error(
        "SyncTranscriber does not accept URLs. Pass a local file path or " +
          "audio bytes, or use client.transcripts for URL/async transcription.",
      );
    }
    if (input.startsWith("data:")) {
      bytes = dataUrlToBytes(input);
    } else {
      const path = getPath(input) ?? input;
      bytes = await readStream(await readFile(path));
      filename = basename(path);
      suffix = extname(filename);
    }
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (input instanceof Blob) {
    bytes = new Uint8Array(await input.arrayBuffer());
    // File instances carry a name; the File global itself needs Node >= 20.
    const name = (input as { name?: string }).name;
    if (name) {
      filename = basename(name);
      suffix = extname(filename);
    }
  } else if (isWebReadableStream(input)) {
    bytes = await readStream(input);
  } else if (isAsyncIterable(input)) {
    bytes = await readAsyncIterable(input);
    // fs.ReadStream carries the path it was opened from.
    const path = (input as { path?: string | Buffer }).path;
    if (typeof path === "string") {
      filename = basename(path);
      suffix = extname(filename);
    }
  } else {
    throw new TypeError("unsupported audio input type");
  }

  const wantsPcm =
    config.sample_rate !== undefined || config.channels !== undefined;
  const isPcm = pcmSuffixes.includes(suffix) || wantsPcm;
  if (
    isPcm &&
    (config.sample_rate === undefined || config.channels === undefined)
  ) {
    throw new Error(
      "raw PCM audio requires both sample_rate and channels in the config",
    );
  }

  const contentType = isPcm ? "audio/pcm" : "audio/wav";
  if (!filename) filename = isPcm ? "audio.pcm" : "audio.wav";

  return { bytes, filename, contentType };
}

/**
 * Serialize the config to the JSON `config` part, validating and normalizing
 * field values to match the server's caps. The routing `model` is never
 * included — it travels in the `X-AAI-Model` header. Returns `undefined`
 * when there is nothing to send, so the part can be omitted entirely.
 */
function buildConfigJson(
  config: SyncTranscriptionConfig,
): Record<string, unknown> | undefined {
  if (config.prompt !== undefined && config.prompt.length > maxPromptLength) {
    throw new Error(
      `prompt exceeds ${maxPromptLength} characters (got ${config.prompt.length})`,
    );
  }

  const json: Record<string, unknown> = {};
  if (config.prompt !== undefined) json["prompt"] = config.prompt;
  const keytermsPrompt = normalizeKeytermsPrompt(config.keyterms_prompt);
  if (keytermsPrompt) json["keyterms_prompt"] = keytermsPrompt;
  const context = normalizeConversationContext(config.conversation_context);
  if (context) json["conversation_context"] = context;
  if (config.language_codes !== undefined)
    json["language_codes"] = config.language_codes;
  if (config.sample_rate !== undefined)
    json["sample_rate"] = config.sample_rate;
  if (config.channels !== undefined) json["channels"] = config.channels;
  if (config.timestamps !== undefined) json["timestamps"] = config.timestamps;

  return Object.keys(json).length > 0 ? json : undefined;
}

function normalizeKeytermsPrompt(
  keytermsPrompt?: string[],
): string[] | undefined {
  if (!keytermsPrompt) return undefined;
  const terms = keytermsPrompt
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
  const total = terms.reduce((sum, term) => sum + term.length, 0);
  if (total > maxKeytermsPromptLength) {
    throw new Error(
      `keyterms_prompt exceeds ${maxKeytermsPromptLength} characters (got ${total})`,
    );
  }
  return terms.length > 0 ? terms : undefined;
}

function normalizeConversationContext(
  context?: string | string[],
): string[] | undefined {
  if (context === undefined) return undefined;
  let turns = (typeof context === "string" ? [context] : context)
    .map((turn) => turn.trim())
    .filter((turn) => turn.length > 0);
  let total = turns.reduce((sum, turn) => sum + turn.length, 0);
  // Over-cap context is trimmed oldest-first, never rejected.
  while (
    turns.length > 0 &&
    (turns.length > maxContextTurns || total > maxContextLength)
  ) {
    total -= turns[0].length;
    turns = turns.slice(1);
  }
  return turns.length > 0 ? turns : undefined;
}

/**
 * Build a SyncTranscriptError from a non-200 response. The primary format
 * is an RFC 9457 problem-details body (`status`/`title`/`detail`); legacy
 * `{error_code, message}` and `{detail}`-only bodies are also accepted.
 */
async function errorFromResponse(
  response: Response,
): Promise<SyncTranscriptError> {
  let errorCode: string | undefined;
  let message: string | undefined;

  const text = await response.text();
  try {
    const body = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      if (typeof body.error_code === "string") errorCode = body.error_code;
      if (errorCode === undefined && typeof body.title === "string") {
        errorCode = body.title.toLowerCase().replace(/ /g, "_");
      }
      if (typeof body.detail === "string") message = body.detail;
      else if (typeof body.message === "string") message = body.message;
    }
  } catch {
    if (text) message = text;
  }
  if (!message) {
    message = `sync transcription failed with status ${response.status}`;
  }

  const retryHeader = response.headers.get("retry-after");
  const retryAfter =
    retryHeader && /^\d+$/.test(retryHeader)
      ? parseInt(retryHeader, 10)
      : undefined;

  return new SyncTranscriptError(
    message,
    response.status,
    errorCode,
    retryAfter,
  );
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function extname(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex > 0 ? filename.slice(dotIndex).toLowerCase() : "";
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isWebReadableStream(
  input: unknown,
): input is ReadableStream<Uint8Array> {
  return typeof (input as ReadableStream<Uint8Array>)?.getReader === "function";
}

function isAsyncIterable(input: unknown): input is AsyncIterable<Uint8Array> {
  return (
    typeof (input as AsyncIterable<Uint8Array>)?.[Symbol.asyncIterator] ===
    "function"
  );
}

async function readStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return concatChunks(chunks);
}

async function readAsyncIterable(
  iterable: AsyncIterable<Uint8Array>,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return concatChunks(chunks);
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
