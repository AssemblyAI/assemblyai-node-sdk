import { createReadStream, mkdtempSync, rmSync, writeFileSync } from "fs";
import fetchMock from "jest-fetch-mock";
import { tmpdir } from "os";
import path from "path";
import { Readable } from "stream";
import { AssemblyAI, DictationError, SyncTranscriptError } from "../../src";
import { defaultApiKey, defaultBaseUrl, requestMatches } from "./utils";

fetchMock.enableMocks();

const testDir = process.env["TESTDATA_DIR"] ?? "tests/static";

const assembly = new AssemblyAI({
  baseUrl: defaultBaseUrl,
  dictationBaseUrl: defaultBaseUrl,
  apiKey: defaultApiKey,
});

const okResponse = {
  text: "take two tablets daily",
  words: [
    { text: "take", confidence: 0.99 },
    { text: "two", confidence: 0.97 },
  ],
  confidence: 0.98,
  llm_response: null,
  llm_error: null,
  audio_duration_ms: 1400,
  session_id: "eb92c4ff-4bbb-429f-9b99-7279d7fe738f",
  request_time_ms: 243.7,
  sync_time_ms: 180.2,
};

const liveUrl = "/v1/transcribe/live";
const warmUrl = "/v1/warm";

type NamedBlob = Blob & { name?: string };

function mockOk(body: object = okResponse) {
  fetchMock.doMockOnceIf(
    requestMatches({ url: liveUrl, method: "POST" }),
    JSON.stringify(body),
  );
}

function mockError(status: number, body: object, headers = {}) {
  fetchMock.doMockOnceIf(
    requestMatches({ url: liveUrl, method: "POST" }),
    JSON.stringify(body),
    { status, headers },
  );
}

function requestInit(index = 0): RequestInit & { duplex?: string } {
  return fetchMock.mock.calls[index][1] as RequestInit & { duplex?: string };
}

function requestHeaders(index = 0): Record<string, string> {
  return requestInit(index).headers as Record<string, string>;
}

/** Drains the streamed request body the way a transport would. */
async function requestBodyBytes(index = 0): Promise<Uint8Array> {
  const body = requestInit(index).body as ReadableStream<Uint8Array>;
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

type Part = {
  name: string;
  filename?: string;
  type?: string;
  body: Uint8Array;
};

/** Parses multipart body bytes into their parts, in order. */
function parseParts(bytes: Uint8Array, index = 0): Part[] {
  const contentType = requestHeaders(index)["Content-Type"];
  const boundary = /boundary=([^;]+)/.exec(contentType)![1];
  const text = new TextDecoder("latin1").decode(bytes);
  const parts: Part[] = [];
  for (const raw of text.split(`--${boundary}`)) {
    if (raw === "" || raw.startsWith("--")) continue;
    const [headerText, ...rest] = raw.replace(/^\r\n/, "").split("\r\n\r\n");
    const bodyText = rest.join("\r\n\r\n").replace(/\r\n$/, "");
    const name = /name="([^"]*)"/.exec(headerText)![1];
    const filename = /filename="([^"]*)"/.exec(headerText)?.[1];
    const type = /Content-Type: ([^\r\n]+)/.exec(headerText)?.[1];
    parts.push({
      name,
      filename,
      type,
      body: Uint8Array.from(bodyText, (ch) => ch.charCodeAt(0)),
    });
  }
  return parts;
}

/** Drains the streamed request body and parses it into parts. */
async function requestParts(index = 0): Promise<Part[]> {
  return parseParts(await requestBodyBytes(index), index);
}

/** Parses the JSON `config` part of a request. */
async function configPart(index = 0): Promise<Record<string, unknown>> {
  const parts = await requestParts(index);
  return JSON.parse(decode(parts[0].body));
}

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

async function* chunks(...pieces: Uint8Array[]) {
  for (const piece of pieces) yield piece;
}

const bytes = (s: string) => new TextEncoder().encode(s);

beforeEach(() => {
  fetchMock.resetMocks();
  fetchMock.doMock();
});

describe("dictation upload", () => {
  it("should send config before audio and stream the body chunked", async () => {
    mockOk();
    const result = await assembly.dictation.transcribeLive(
      chunks(bytes("RIFF"), bytes("fake")),
      { stt_prompt: "A doctor dictating a patient visit note." },
    );

    expect(result.text).toBe("take two tablets daily");
    expect(fetchMock.mock.calls[0][0]).toBe(defaultBaseUrl + liveUrl);
    expect(requestInit().duplex).toBe("half");
    expect(requestInit().body).toBeInstanceOf(ReadableStream);
    expect(requestHeaders()["Content-Type"]).toMatch(
      /^multipart\/form-data; boundary=----assemblyai-[0-9a-z]{32}$/,
    );

    const parts = await requestParts();
    expect(parts.map((p) => p.name)).toEqual(["config", "audio"]);
    expect(JSON.parse(decode(parts[0].body))).toEqual({
      stt_prompt: "A doctor dictating a patient visit note.",
    });
    expect(parts[0].type).toBe("application/json");
    expect(decode(parts[1].body)).toBe("RIFFfake");
    expect(parts[1].type).toBe("audio/wav");
    expect(parts[1].filename).toBe("audio.wav");
  });

  it("should always send a config part, empty when there are no options", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(chunks(bytes("RIFF")));
    const parts = await requestParts();
    expect(parts.map((p) => p.name)).toEqual(["config", "audio"]);
    expect(decode(parts[0].body)).toBe("{}");
  });

  it("should send the raw api key and no model header", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(chunks(bytes("RIFF")));
    expect(requestHeaders()["Authorization"]).toBe(defaultApiKey);
    expect(requestHeaders()["X-AAI-Model"]).toBeUndefined();
  });

  it("should post to the dictation host by default", async () => {
    const url = "https://dictation.assemblyai.com" + liveUrl;
    fetchMock.doMockOnceIf(
      (input: Request) => input.url === url,
      JSON.stringify(okResponse),
    );
    const client = new AssemblyAI({ apiKey: defaultApiKey });
    await client.dictation.transcribeLive(chunks(bytes("RIFF")));
    expect(fetchMock.mock.calls[0][0]).toBe(url);
  });

  it("should drop empty chunks and accept ArrayBuffer chunks", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(
      chunks(
        bytes("RIFF"),
        new Uint8Array(0),
        bytes("wav").buffer as unknown as Uint8Array,
      ),
    );
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFFwav");
  });

  it("should escape a file name that would break the part header", async () => {
    mockOk();
    const stream = Readable.from([bytes("RIFF")]) as Readable & {
      path: string;
    };
    stream.path = 'we"ird\r\nname.wav';
    await assembly.dictation.transcribeLive(stream);
    const parts = await requestParts();
    expect(parts.map((p) => p.name)).toEqual(["config", "audio"]);
    expect(parts[1].filename).toBe("we%22ird%0D%0Aname.wav");
    expect(decode(parts[1].body)).toBe("RIFF");
  });

  it("should escape a tab in a real path file name, passing ESC through", async () => {
    mockOk();
    const dir = mkdtempSync(path.join(tmpdir(), "aai-dictation-"));
    // A tab and an ESC control character — both valid bytes in a POSIX file
    // name. No backslash here: the SDK's basename() splits a path on both
    // `/` and `\`, so a path input can never carry one into the file name
    // (see the File-based test below for that case).
    const weirdName = `b\tc\x1bd.wav`;
    const filePath = path.join(dir, weirdName);
    writeFileSync(filePath, Buffer.from("RIFFfake"));
    try {
      await assembly.dictation.transcribeLive(filePath);
      const parts = await requestParts();
      expect(parts[1].filename).toBe(`b%09c\x1bd.wav`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("should escape a quote and tab in a File name", async () => {
    mockOk();
    // basename() is applied to a File/Blob `.name` the same as a path, so a
    // backslash in it is also split off rather than reaching the escaper —
    // there is no public input that carries a backslash through to it.
    const file: NamedBlob = new Blob([bytes("RIFFfake") as BlobPart]);
    file.name = `b"c\td.wav`;
    await assembly.dictation.transcribeLive(file);
    const parts = await requestParts();
    expect(parts[1].filename).toBe(`b%22c%09d.wav`);
  });
});

describe("dictation audio inputs", () => {
  it("should send raw bytes as a single chunk", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(bytes("RIFFfake"));
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFFfake");
    expect(parts[1].filename).toBe("audio.wav");
    expect(parts[1].type).toBe("audio/wav");
  });

  it("should send an ArrayBuffer as a single chunk", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(
      bytes("RIFFfake").buffer as ArrayBuffer,
    );
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFFfake");
  });

  it("should send a Blob and take its name and format", async () => {
    mockOk();
    // Named like a File without the File global, which needs Node >= 20.
    const file: NamedBlob = new Blob([bytes("ID3fake") as BlobPart]);
    file.name = "note.mp3";
    await assembly.dictation.transcribeLive(file);
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("ID3fake");
    expect(parts[1].filename).toBe("note.mp3");
    expect(parts[1].type).toBe("audio/mpeg");
  });

  it("should send an unnamed Blob as WAV", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(
      new Blob([bytes("RIFFfake") as BlobPart]),
    );
    const parts = await requestParts();
    expect(parts[1].filename).toBe("audio.wav");
    expect(parts[1].type).toBe("audio/wav");
  });

  it("should read a local file path and take its name and format", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(
      path.join(testDir, "gore-short.wav"),
    );
    const parts = await requestParts();
    expect(parts[1].filename).toBe("gore-short.wav");
    expect(parts[1].type).toBe("audio/wav");
    expect(parts[1].body.length).toBeGreaterThan(1000);
  });

  it("should decode a data URL", async () => {
    mockOk();
    const base64 = Buffer.from("RIFFfake").toString("base64");
    await assembly.dictation.transcribeLive(`data:audio/wav;base64,${base64}`);
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFFfake");
    expect(parts[1].filename).toBe("audio.wav");
  });

  it("should accept an async generator", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(chunks(bytes("RIFF"), bytes("2")));
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFF2");
  });

  it("should accept a Node readable stream", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(
      Readable.from([bytes("RIFF"), bytes("fake")]),
    );
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFFfake");
  });

  it("should take the file name and format from an fs stream", async () => {
    mockOk();
    const stream = createReadStream(path.join(testDir, "gore-short.wav"));
    await assembly.dictation.transcribeLive(stream);
    const parts = await requestParts();
    expect(parts[1].filename).toBe("gore-short.wav");
    expect(parts[1].type).toBe("audio/wav");
    expect(parts[1].body.length).toBeGreaterThan(1000);
  });

  it("should accept a web ReadableStream", async () => {
    mockOk();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes("RIFF"));
        controller.enqueue(bytes("fake"));
        controller.close();
      },
    });
    await assembly.dictation.transcribeLive(stream);
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFFfake");
  });

  it("should accept a sync iterable", async () => {
    mockOk();
    await assembly.dictation.transcribeLive([bytes("RIFF"), bytes("fake")]);
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFFfake");
  });

  it("should reject a URL, pointing at the transcripts service", async () => {
    await expect(
      assembly.dictation.transcribeLive("https://example.com/note.wav"),
    ).rejects.toThrow("DictationTranscriber does not accept URLs");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should reject an unsupported input type", async () => {
    const error = await assembly.dictation
      .transcribeLive(42 as never)
      .catch((e) => e);
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toBe("unsupported audio input type: number");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should reject text chunks with a pointed message", async () => {
    // The chunk check runs as the body streams, so the mock must read the
    // body the way a real transport does.
    fetchMock.doMockOnceIf(
      requestMatches({ url: liveUrl, method: "POST" }),
      async () => {
        await requestBodyBytes();
        return JSON.stringify(okResponse);
      },
    );
    await expect(
      assembly.dictation.transcribeLive(["RIFF", "fake"] as never),
    ).rejects.toThrow("not strings");
  });

  it("should mark raw PCM from the config", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(chunks(bytes("\x00\x01")), {
      sample_rate: 16000,
      channels: 1,
    });
    const parts = await requestParts();
    expect(parts[1].type).toBe("audio/pcm");
    expect(parts[1].filename).toBe("audio.pcm");
  });

  it("should require both PCM fields before any request", async () => {
    await expect(
      assembly.dictation.transcribeLive(chunks(bytes("\x00")), {
        sample_rate: 16000,
      }),
    ).rejects.toThrow("sample_rate and channels");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should require both PCM fields for a .pcm source", async () => {
    const stream = Readable.from([bytes("\x00")]) as Readable & {
      path: string;
    };
    stream.path = "note.pcm";
    await expect(assembly.dictation.transcribeLive(stream)).rejects.toThrow(
      "sample_rate and channels",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("dictation config", () => {
  it("should exclude fields that were not set", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(chunks(bytes("RIFF")), {
      language_codes: ["es"],
    });
    expect(await configPart()).toEqual({ language_codes: ["es"] });
  });

  it("should serialise every accepted field", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(chunks(bytes("\x00")), {
      sample_rate: 16000,
      channels: 1,
      language_codes: ["en", "es"],
      stt_prompt: "A doctor dictating a patient visit note.",
      keyterms_prompt: ["AssemblyAI", "U3-Pro"],
      llm_instruction: "Format this as a SOAP note.",
    });
    expect(await configPart()).toEqual({
      sample_rate: 16000,
      channels: 1,
      language_codes: ["en", "es"],
      stt_prompt: "A doctor dictating a patient visit note.",
      keyterms_prompt: ["AssemblyAI", "U3-Pro"],
      llm_instruction: "Format this as a SOAP note.",
    });
  });

  it("should never send keys the dictation API does not accept", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(chunks(bytes("RIFF")), {
      stt_prompt: "a note",
      model: "universal-3-5-pro",
      timestamps: true,
      conversation_context: ["earlier"],
    } as never);
    expect(await configPart()).toEqual({ stt_prompt: "a note" });
  });

  it("should trim keyterms and drop the empty ones", async () => {
    mockOk();
    await assembly.dictation.transcribeLive(chunks(bytes("RIFF")), {
      keyterms_prompt: ["  AssemblyAI  ", "   ", ""],
    });
    expect(await configPart()).toEqual({ keyterms_prompt: ["AssemblyAI"] });
  });

  it("should reject an oversized stt_prompt before any request", async () => {
    await expect(
      assembly.dictation.transcribeLive(chunks(bytes("RIFF")), {
        stt_prompt: "a".repeat(6001),
      }),
    ).rejects.toThrow("stt_prompt exceeds");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should accept a 5000-char stt_prompt", async () => {
    mockOk();
    const sttPrompt = "a".repeat(5000);
    await assembly.dictation.transcribeLive(chunks(bytes("RIFF")), {
      stt_prompt: sttPrompt,
    });
    expect(await configPart()).toEqual({ stt_prompt: sttPrompt });
  });

  it("should reject an oversized llm_instruction before any request", async () => {
    await expect(
      assembly.dictation.transcribeLive(chunks(bytes("RIFF")), {
        llm_instruction: "a".repeat(2049),
      }),
    ).rejects.toThrow("llm_instruction exceeds 2048 characters (got 2049)");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should reject an oversized keyterms_prompt before any request", async () => {
    await expect(
      assembly.dictation.transcribeLive(chunks(bytes("RIFF")), {
        keyterms_prompt: ["a".repeat(4000), "b".repeat(4001)],
      }),
    ).rejects.toThrow("characters");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should reject more than 100 keyterms_prompt terms", async () => {
    const terms = Array.from({ length: 101 }, (_, i) => `term${i}`);
    await expect(
      assembly.dictation.transcribeLive(chunks(bytes("RIFF")), {
        keyterms_prompt: terms,
      }),
    ).rejects.toThrow("keyterms_prompt exceeds 100 terms");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should accept exactly 100 keyterms_prompt terms", async () => {
    mockOk();
    const terms = Array.from({ length: 100 }, (_, i) => `term${i}`);
    await assembly.dictation.transcribeLive(chunks(bytes("RIFF")), {
      keyterms_prompt: terms,
    });
    const config = await configPart();
    expect(config.keyterms_prompt).toEqual(terms);
  });
});

describe("dictation response", () => {
  it("should parse every field of the response", async () => {
    mockOk();
    const result = await assembly.dictation.transcribeLive(
      chunks(bytes("RIFF")),
    );
    expect(result.text).toBe("take two tablets daily");
    expect(result.words[1]).toEqual({ text: "two", confidence: 0.97 });
    expect(result.confidence).toBe(0.98);
    expect(result.audio_duration_ms).toBe(1400);
    expect(result.session_id).toBe(okResponse.session_id);
    expect(result.request_time_ms).toBe(243.7);
    expect(result.sync_time_ms).toBe(180.2);
  });

  it("should prefer the LLM rewrite for final_text", async () => {
    mockOk({ ...okResponse, llm_response: "Take 2 tablets daily." });
    const result = await assembly.dictation.transcribeLive(
      chunks(bytes("RIFF")),
      { llm_instruction: "Clean this up." },
    );
    expect(result.final_text).toBe("Take 2 tablets daily.");
    expect(result.text).toBe("take two tablets daily");
  });

  it("should fall back to the raw transcript for final_text", async () => {
    mockOk();
    const withNull = await assembly.dictation.transcribeLive(
      chunks(bytes("RIFF")),
    );
    expect(withNull.final_text).toBe("take two tablets daily");

    const withoutField: Partial<typeof okResponse> = { ...okResponse };
    delete withoutField.llm_response;
    mockOk(withoutField);
    const absent = await assembly.dictation.transcribeLive(
      chunks(bytes("RIFF")),
    );
    expect(absent.final_text).toBe("take two tablets daily");
  });

  it("should pass an LLM failure through", async () => {
    mockOk({ ...okResponse, llm_error: "the LLM pass timed out" });
    const result = await assembly.dictation.transcribeLive(
      chunks(bytes("RIFF")),
    );
    expect(result.llm_error).toBe("the LLM pass timed out");
    expect(result.final_text).toBe("take two tablets daily");
  });

  it("should tolerate unknown response fields", async () => {
    mockOk({ ...okResponse, some_new_field: 7 });
    const result = await assembly.dictation.transcribeLive(
      chunks(bytes("RIFF")),
    );
    expect(result.text).toBe("take two tablets daily");
    expect(
      (result as unknown as Record<string, unknown>)["some_new_field"],
    ).toBe(7);
  });
});

describe("dictation errors", () => {
  it("should map a legacy error envelope to DictationError", async () => {
    mockError(400, { error_code: "bad_audio", message: "could not decode" });
    const error = await assembly.dictation
      .transcribeLive(chunks(bytes("RIFF")))
      .catch((e) => e);
    expect(error).toBeInstanceOf(DictationError);
    expect(error).not.toBeInstanceOf(SyncTranscriptError);
    expect(error.name).toBe("DictationError");
    expect(error.status).toBe(400);
    expect(error.errorCode).toBe("bad_audio");
    expect(error.message).toBe("could not decode");
  });

  it("should map a bare error/error_code envelope to DictationError", async () => {
    mockError(401, {
      error: "Invalid API key",
      error_code: "unauthorized",
    });
    const error = await assembly.dictation
      .transcribeLive(chunks(bytes("RIFF")))
      .catch((e) => e);
    expect(error).toBeInstanceOf(DictationError);
    expect(error.message).toBe("Invalid API key");
    expect(error.errorCode).toBe("unauthorized");
  });

  it("should map a problem-details envelope to DictationError", async () => {
    mockError(413, {
      status: 413,
      title: "Audio Too Large",
      detail: "the audio exceeds the size limit",
    });
    const error = await assembly.dictation
      .transcribeLive(chunks(bytes("RIFF")))
      .catch((e) => e);
    expect(error).toBeInstanceOf(DictationError);
    expect(error.errorCode).toBe("audio_too_large");
    expect(error.message).toBe("the audio exceeds the size limit");
  });

  it("should map a detail-only envelope to DictationError", async () => {
    mockError(401, { detail: "Invalid API key" });
    const error = await assembly.dictation
      .transcribeLive(chunks(bytes("RIFF")))
      .catch((e) => e);
    expect(error).toBeInstanceOf(DictationError);
    expect(error.status).toBe(401);
    expect(error.errorCode).toBeUndefined();
    expect(error.message).toBe("Invalid API key");
  });

  it("should surface Retry-After on a rate limit", async () => {
    mockError(
      429,
      { status: 429, title: "Rate Limited", detail: "slow down" },
      { "Retry-After": "3" },
    );
    const error = await assembly.dictation
      .transcribeLive(chunks(bytes("RIFF")))
      .catch((e) => e);
    expect(error).toBeInstanceOf(DictationError);
    expect(error.errorCode).toBe("rate_limited");
    expect(error.retryAfter).toBe(3);
  });

  it("should keep a non-JSON error body as the message", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: liveUrl, method: "POST" }),
      "upstream connect error",
      { status: 502 },
    );
    const error = await assembly.dictation
      .transcribeLive(chunks(bytes("RIFF")))
      .catch((e) => e);
    expect(error).toBeInstanceOf(DictationError);
    expect(error.message).toBe("upstream connect error");
  });

  it("should fall back to a message naming the status", async () => {
    // An empty body must reach the client as a 500, so the status is set on
    // a handler rather than on a falsy body the mock would ignore.
    fetchMock.doMockOnceIf(
      requestMatches({ url: liveUrl, method: "POST" }),
      async () => ({ body: "", init: { status: 500 } }),
    );
    const error = await assembly.dictation
      .transcribeLive(chunks(bytes("RIFF")))
      .catch((e) => e);
    expect(error.message).toBe(
      "dictation transcription failed with status 500",
    );
  });

  it("should end the upload as soon as the server rejects it mid-upload", async () => {
    // fetch resolves with an early error status while the body is still
    // streaming but withholds the response body until the request body ends.
    // The SDK must finish the body itself rather than wait for the producer.
    mockError(401, { detail: "Invalid API key" });
    let pulled = 0;
    async function* endless() {
      for (;;) {
        pulled++;
        yield bytes("\x00\x00");
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    const error = await assembly.dictation
      .transcribeLive(endless(), { sample_rate: 16000, channels: 1 })
      .catch((e) => e);
    expect(error).toBeInstanceOf(DictationError);
    expect(error.status).toBe(401);

    // Draining what the transport would still read ends at the closing
    // boundary without waiting on the (endless) producer.
    const drained = decode(await requestBodyBytes());
    expect(drained.trimEnd().endsWith("--")).toBe(true);
    const pulledAtClose = pulled;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(pulled).toBe(pulledAtClose); // the producer was let go of
  });

  it("should surface what the producer threw, not fetch's wrapper", async () => {
    // undici reports a failed request body as `TypeError: fetch failed` with
    // the real error on `cause`; the SDK must rethrow the original.
    fetchMock.doMockOnceIf(
      requestMatches({ url: liveUrl, method: "POST" }),
      async () => {
        try {
          await requestBodyBytes();
        } catch (cause) {
          throw Object.assign(new TypeError("fetch failed"), { cause });
        }
        return JSON.stringify(okResponse);
      },
    );
    async function* failing() {
      yield bytes("RIFF");
      throw new Error("microphone unplugged");
    }
    await expect(assembly.dictation.transcribeLive(failing())).rejects.toThrow(
      "microphone unplugged",
    );
  });
});

describe("dictation deadlines", () => {
  function mockAbortable() {
    fetchMock.doMockOnceIf(
      requestMatches({ url: liveUrl, method: "POST" }),
      async (request) => {
        // Behave like a transport: give up when the signal fires.
        await new Promise<void>((resolve) => {
          request.signal.addEventListener("abort", () => resolve(), {
            once: true,
          });
        });
        throw Object.assign(new Error("The operation was aborted."), {
          name: "AbortError",
        });
      },
    );
  }

  async function* forever() {
    yield bytes("RIFF");
    await new Promise(() => undefined);
  }

  it("should give up once the timeout elapses", async () => {
    mockAbortable();
    await expect(
      assembly.dictation.transcribeLive(forever(), {}, { timeout: 1 }),
    ).rejects.toThrow("aborted");
  });

  it("should honour an external abort signal", async () => {
    mockAbortable();
    const controller = new AbortController();
    const pending = assembly.dictation.transcribeLive(
      forever(),
      {},
      { signal: controller.signal },
    );
    controller.abort();
    await expect(pending).rejects.toThrow("aborted");
  });
});

describe("dictation warm", () => {
  it("should probe the warm endpoint on the dictation host", async () => {
    fetchMock.doMockOnceIf(requestMatches({ url: warmUrl, method: "GET" }), "");
    expect(await assembly.dictation.warm()).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(defaultBaseUrl + warmUrl);
    expect(requestInit().method).toBe("GET");
    expect(requestHeaders()["X-AAI-Model"]).toBeUndefined();
  });

  it("should report success on any HTTP response", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: warmUrl, method: "GET" }),
      async () => ({ body: "", init: { status: 404 } }),
    );
    expect(await assembly.dictation.warm()).toBe(true);
  });

  it("should report failure when the connection cannot be opened", async () => {
    fetchMock.mockRejectOnce(new Error("getaddrinfo ENOTFOUND"));
    expect(await assembly.dictation.warm()).toBe(false);
  });
});

describe("dictation session", () => {
  it("should upload written chunks in order and resolve the transcript", async () => {
    mockOk();
    const session = assembly.dictation.openLive({
      sample_rate: 16000,
      channels: 1,
    });
    session.write(bytes("\x00\x01"));
    session.write(new Uint8Array([2, 3]).buffer);
    session.write(new Uint8Array(0)); // dropped
    const result = await session.result();

    expect(result.text).toBe("take two tablets daily");
    expect(session.closed).toBe(true);
    const parts = await requestParts();
    expect(parts.map((p) => p.name)).toEqual(["config", "audio"]);
    expect(JSON.parse(decode(parts[0].body))).toEqual({
      sample_rate: 16000,
      channels: 1,
    });
    expect(Array.from(parts[1].body)).toEqual([0, 1, 2, 3]);
    expect(parts[1].type).toBe("audio/pcm");
    expect(parts[1].filename).toBe("audio.pcm");
  });

  it("should start the request before any audio is written", async () => {
    mockOk();
    const session = assembly.dictation.openLive();
    // The request is dispatched on open, which is the point: connection and
    // config go out while the speaker is still talking.
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    session.close();
    await session.result();
  });

  it("should treat close() as idempotent", async () => {
    mockOk();
    const session = assembly.dictation.openLive();
    session.write(bytes("RIFF"));
    session.close();
    session.close();
    expect(session.closed).toBe(true);
    const result = await session.result();
    expect(result.final_text).toBe("take two tablets daily");
  });

  it("should drop, not throw, on a write after close", async () => {
    mockOk();
    const session = assembly.dictation.openLive();
    session.write(bytes("RIFF"));
    session.close();
    // A capture callback still firing after close must not throw into itself.
    expect(() => session.write(bytes("late"))).not.toThrow();
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFF"); // the late chunk was dropped
    await session.result();
  });

  it("should drop writes after the request has settled instead of throwing", async () => {
    mockError(503, { status: 503, title: "Capacity Exceeded", detail: "x" });
    const session = assembly.dictation.openLive();
    session.write(bytes("RIFF"));
    // The server rejects while the caller has not yet closed or collected.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(() => session.write(bytes("more"))).not.toThrow();
    expect(session.closed).toBe(false);
    await expect(session.result()).rejects.toBeInstanceOf(DictationError);
    // ...and it still drops, not throws, after result() has surfaced the error.
    expect(() => session.write(bytes("later"))).not.toThrow();
  });

  it("should reject text at write time", async () => {
    mockOk();
    const session = assembly.dictation.openLive();
    expect(() => session.write("RIFF" as never)).toThrow(TypeError);
    await session.result();
  });

  it("should abort the request and reject result() afterwards", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: liveUrl, method: "POST" }),
      async (request) => {
        await new Promise<void>((resolve) => {
          request.signal.addEventListener("abort", () => resolve(), {
            once: true,
          });
        });
        throw Object.assign(new Error("The operation was aborted."), {
          name: "AbortError",
        });
      },
    );
    const session = assembly.dictation.openLive();
    session.write(bytes("RIFF"));
    await session.abort();
    expect(session.closed).toBe(true);
    await expect(session.result()).rejects.toThrow("aborted");
    await session.abort(); // idempotent
  });

  it("should treat abort() after completion as a no-op", async () => {
    mockOk();
    const session = assembly.dictation.openLive();
    session.write(bytes("RIFF"));
    const result = await session.result();

    // The request already finished, so aborting must not mask the transcript.
    await session.abort();
    expect(await session.result()).toBe(result);
  });

  it("should surface a server error from result()", async () => {
    mockError(503, {
      status: 503,
      title: "Capacity Exceeded",
      detail: "no capacity",
    });
    const session = assembly.dictation.openLive();
    session.write(bytes("RIFF"));
    const error = await session.result().catch((e) => e);
    expect(error).toBeInstanceOf(DictationError);
    expect(error.errorCode).toBe("capacity_exceeded");
  });

  it("should accept a piped web stream via stream()", async () => {
    // Drain the body inside the handler, the way a real transport does, so the
    // assertion does not race the pipe against a later manual read.
    let uploaded: Uint8Array | undefined;
    fetchMock.doMockOnceIf(
      requestMatches({ url: liveUrl, method: "POST" }),
      async () => {
        uploaded = await requestBodyBytes();
        return JSON.stringify(okResponse);
      },
    );
    const session = assembly.dictation.openLive();
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes("RIFF"));
        controller.enqueue(bytes("fake"));
        controller.close();
      },
    });
    // Await the pipe first: it closes the session when the source ends, and
    // result() would otherwise close it out from under the still-writing pipe.
    await source.pipeTo(session.stream());
    expect(session.closed).toBe(true);
    const result = await session.result();
    expect(result.text).toBe("take two tablets daily");
    const parts = parseParts(uploaded!);
    expect(decode(parts[1].body)).toBe("RIFFfake");
  });
});

describe("dictation routing", () => {
  it("should never request the buffered transcription endpoint", async () => {
    mockOk();
    mockOk();
    await assembly.dictation.transcribeLive(
      path.join(testDir, "gore-short.wav"),
    );
    await assembly.dictation.transcribeLive(chunks(bytes("RIFF")));
    expect(fetchMock.mock.calls).toHaveLength(2);
    for (const [url] of fetchMock.mock.calls) {
      expect(url).toBe(defaultBaseUrl + liveUrl);
    }
  });
});
