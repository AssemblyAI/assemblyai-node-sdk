import { createReadStream, mkdtempSync, rmSync, writeFileSync } from "fs";
import fetchMock from "jest-fetch-mock";
import { tmpdir } from "os";
import path from "path";
import { SyncTranscriptError } from "../../src";
import { createClient, defaultBaseUrl, requestMatches } from "./utils";

fetchMock.enableMocks();

const testDir = process.env["TESTDATA_DIR"] ?? "tests/static";

const assembly = createClient();

const fakeWavBytes = new TextEncoder().encode("RIFFfake-wav-bytes");

const okResponse = {
  text: "hello world",
  words: [
    { text: "hello", start: 0, end: 200, confidence: 0.9 },
    { text: "world", start: 220, end: 400, confidence: 0.95 },
  ],
  confidence: 0.92,
  audio_duration_ms: 400,
  session_id: "eb92c4ff-4bbb-429f-9b99-7279d7fe738f",
  request_time_ms: 243.7,
};

// `transcribe()` rides the same chunked-multipart live upload as
// `transcribeLive()` / `openLive()` — the buffered endpoint is never used.
const liveUrl = "/v1/transcribe/live";

function mockOk() {
  fetchMock.doMockOnceIf(
    requestMatches({ url: liveUrl, method: "POST" }),
    JSON.stringify(okResponse),
  );
}

/** Behaves like a transport: gives up when the request's signal fires. */
function mockAbortable() {
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
}

type NamedBlob = Blob & { name?: string };

function requestInit(index = 0): RequestInit & { duplex?: string } {
  return fetchMock.mock.calls[index][1] as RequestInit & { duplex?: string };
}

function requestHeaders(index = 0): Record<string, string> {
  return requestInit(index).headers as Record<string, string>;
}

/** Drains a `ReadableStream` the way a transport would. */
async function drainStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
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

// A `ReadableStream` can only be read once, but several helpers (and
// several assertions within one test) may each want the drained bytes —
// cache the drain per request index so any number of calls is safe.
const bodyBytesCache = new Map<number, Promise<Uint8Array>>();

/** Drains the streamed request body the way a transport would. */
function requestBodyBytes(index = 0): Promise<Uint8Array> {
  let cached = bodyBytesCache.get(index);
  if (!cached) {
    cached = drainStream(requestInit(index).body as ReadableStream<Uint8Array>);
    bodyBytesCache.set(index, cached);
  }
  return cached;
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

beforeEach(() => {
  fetchMock.resetMocks();
  fetchMock.doMock();
  bodyBytesCache.clear();
});

describe("sync", () => {
  it("should transcribe bytes and parse the response", async () => {
    mockOk();
    const result = await assembly.sync.transcribe(fakeWavBytes);
    expect(result.text).toBe("hello world");
    expect(result.session_id).toBe(okResponse.session_id);
    expect(result.words[0].start).toBe(0);
    expect(result.words[0].end).toBe(200);
    expect(result.words[1].text).toBe("world");
    expect(result.request_time_ms).toBe(243.7);
  });

  it("should parse a response without request_time_ms", async () => {
    const response: Partial<typeof okResponse> = { ...okResponse };
    delete response.request_time_ms;
    fetchMock.doMockOnceIf(
      requestMatches({ url: liveUrl, method: "POST" }),
      JSON.stringify(response),
    );
    const result = await assembly.sync.transcribe(fakeWavBytes);
    expect(result.request_time_ms).toBeUndefined();
  });

  it("should stream a chunked multipart body with the config part first", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes);
    expect(fetchMock.mock.calls[0][0]).toBe(defaultBaseUrl + liveUrl);
    expect(requestInit().duplex).toBe("half");
    expect(requestInit().body).toBeInstanceOf(ReadableStream);
    expect(requestHeaders()["X-AAI-Model"]).toBe("universal-3-5-pro");
    expect(requestHeaders()["Content-Type"]).toMatch(/^multipart\/form-data;/);

    const parts = await requestParts();
    expect(parts.map((p) => p.name)).toEqual(["config", "audio"]);
    expect(decode(parts[0].body)).toBe("{}");
    expect(parts[0].type).toBe("application/json");
    expect(parts[1].type).toBe("audio/wav");
  });

  it("should send the prompt and normalized keyterms_prompt", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, {
      prompt: "Transcribe verbatim.",
      keyterms_prompt: ["AssemblyAI", "  Lemur  ", ""],
    });
    const config = await configPart();
    expect(config).toEqual({
      prompt: "Transcribe verbatim.",
      keyterms_prompt: ["AssemblyAI", "Lemur"],
    });
  });

  it("should never send the model in the config part", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, {
      model: "some-other-model",
      prompt: "Transcribe verbatim.",
    });
    expect(requestHeaders()["X-AAI-Model"]).toBe("some-other-model");
    const config = await configPart();
    expect(config).not.toHaveProperty("model");
  });

  it("should send an empty config part when only the model is set", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, {
      model: "some-other-model",
    });
    expect(await configPart()).toEqual({});
  });

  it("should send conversation_context turns, stripped with empties dropped", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, {
      conversation_context: [
        "I'd like to book a flight to Denver.",
        "  Sure, what date were you thinking?  ",
        "",
      ],
    });
    const config = await configPart();
    expect(config?.conversation_context).toEqual([
      "I'd like to book a flight to Denver.",
      "Sure, what date were you thinking?",
    ]);
  });

  it("should coerce a conversation_context string to a one-turn list", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, {
      conversation_context: "Sure, what date were you thinking?",
    });
    const config = await configPart();
    expect(config?.conversation_context).toEqual([
      "Sure, what date were you thinking?",
    ]);
  });

  it("should trim the oldest conversation turns over the char cap", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, {
      conversation_context: ["a".repeat(10000), "b".repeat(10000)],
    });
    const config = await configPart();
    expect(config?.conversation_context).toEqual(["b".repeat(10000)]);
  });

  it("should trim the oldest conversation turns over the turn cap", async () => {
    mockOk();
    const turns = Array.from({ length: 520 }, (_, i) => `turn ${i}`);
    await assembly.sync.transcribe(fakeWavBytes, {
      conversation_context: turns,
    });
    const config = await configPart();
    expect(config?.conversation_context).toEqual(turns.slice(20));
  });

  it("should trim to nothing when a single turn is over the char cap", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, {
      conversation_context: ["a".repeat(20000)],
    });
    const config = await configPart();
    expect(config).not.toHaveProperty("conversation_context");
  });

  it("should send a single-element language_codes list", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, {
      language_codes: ["es"],
    });
    const config = await configPart();
    expect(config?.language_codes).toEqual(["es"]);
  });

  it("should send a language_codes list", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, {
      language_codes: ["en", "es"],
    });
    const config = await configPart();
    expect(config?.language_codes).toEqual(["en", "es"]);
  });

  it("should send an empty config part for a default config", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes);
    expect(await configPart()).toEqual({});
  });

  it("should send the timestamps flag when opted in", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, { timestamps: true });
    const config = await configPart();
    expect(config).toEqual({ timestamps: true });
  });

  it("should parse words without start/end timings", async () => {
    // Without timestamps in the config, the server omits the fields
    // rather than sending null.
    const response = {
      ...okResponse,
      words: [
        { text: "hello", confidence: 0.9 },
        { text: "world", confidence: 0.95 },
      ],
    };
    fetchMock.doMockOnceIf(
      requestMatches({ url: liveUrl, method: "POST" }),
      JSON.stringify(response),
    );
    const result = await assembly.sync.transcribe(fakeWavBytes);
    expect(result.words[0].text).toBe("hello");
    expect(result.words[0].start).toBeUndefined();
    expect(result.words[0].end).toBeUndefined();
    expect(result.words[1].confidence).toBe(0.95);
  });

  it("should send a PCM part with rate and channels", async () => {
    mockOk();
    await assembly.sync.transcribe(new Uint8Array(200), {
      sample_rate: 16000,
      channels: 1,
    });
    const parts = await requestParts();
    expect(parts[1].type).toBe("audio/pcm");
    const config = await configPart();
    expect(config).toEqual({ sample_rate: 16000, channels: 1 });
  });

  it("should reject PCM without channels before any request", async () => {
    await expect(
      assembly.sync.transcribe(new Uint8Array(200), { sample_rate: 16000 }),
    ).rejects.toThrow("sample_rate and channels");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should reject URLs", async () => {
    await expect(
      assembly.sync.transcribe("https://example.com/audio.wav"),
    ).rejects.toThrow("does not accept URLs");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should ship a file path input under its own name", async () => {
    mockOk();
    const result = await assembly.sync.transcribe(
      path.join(testDir, "gore-short.wav"),
    );
    expect(result.text).toBe("hello world");
    const parts = await requestParts();
    expect(parts[1].filename).toBe("gore-short.wav");
    expect(parts[1].type).toBe("audio/wav");
  });

  it("should transcribe a Node stream and use its file name", async () => {
    mockOk();
    const stream = createReadStream(path.join(testDir, "gore-short.wav"));
    const result = await assembly.sync.transcribe(stream);
    expect(result.text).toBe("hello world");
    const parts = await requestParts();
    expect(parts[1].filename).toBe("gore-short.wav");
  });

  it("should transcribe a web ReadableStream", async () => {
    mockOk();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(fakeWavBytes);
        controller.close();
      },
    });
    const result = await assembly.sync.transcribe(stream);
    expect(result.text).toBe("hello world");
  });

  it("should transcribe a Blob and use its file name", async () => {
    mockOk();
    // Named like a File without the File global, which needs Node >= 20.
    const file: NamedBlob = new Blob([fakeWavBytes as BlobPart]);
    file.name = "call.wav";
    const result = await assembly.sync.transcribe(file);
    expect(result.text).toBe("hello world");
    const parts = await requestParts();
    expect(parts[1].filename).toBe("call.wav");
  });

  it("should escape a tab in a real path file name, passing ESC through", async () => {
    mockOk();
    const dir = mkdtempSync(path.join(tmpdir(), "aai-sync-"));
    // A tab and an ESC control character — both valid bytes in a POSIX file
    // name. No backslash here: the SDK's basename() splits a path on both
    // `/` and `\`, so a path input can never carry one into the file name
    // (see the File-based test below for that case).
    const weirdName = `b\tc\x1bd.wav`;
    const filePath = path.join(dir, weirdName);
    writeFileSync(filePath, Buffer.from("RIFFfake"));
    try {
      const result = await assembly.sync.transcribe(filePath);
      expect(result.text).toBe("hello world");
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
    const file: NamedBlob = new Blob([fakeWavBytes as BlobPart]);
    file.name = `b"c\td.wav`;
    await assembly.sync.transcribe(file);
    const parts = await requestParts();
    expect(parts[1].filename).toBe(`b%22c%09d.wav`);
  });

  it("should reject an oversized keyterms_prompt", async () => {
    const promise = assembly.sync.transcribe(fakeWavBytes, {
      keyterms_prompt: ["x".repeat(9000)],
    });
    await expect(promise).rejects.toThrow("keyterms_prompt exceeds");
    await expect(promise).rejects.toThrow("characters");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should reject more than 100 keyterms_prompt terms", async () => {
    const terms = Array.from({ length: 101 }, (_, i) => `term${i}`);
    await expect(
      assembly.sync.transcribe(fakeWavBytes, { keyterms_prompt: terms }),
    ).rejects.toThrow("keyterms_prompt exceeds 100 terms");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should accept exactly 100 keyterms_prompt terms", async () => {
    mockOk();
    const terms = Array.from({ length: 100 }, (_, i) => `term${i}`);
    await assembly.sync.transcribe(fakeWavBytes, { keyterms_prompt: terms });
    const config = await configPart();
    expect(config.keyterms_prompt).toEqual(terms);
  });

  it("should reject an oversized prompt", async () => {
    await expect(
      assembly.sync.transcribe(fakeWavBytes, { prompt: "x".repeat(7000) }),
    ).rejects.toThrow("prompt exceeds");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should map a problem-details envelope to a SyncTranscriptError", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        status: 413,
        title: "Audio Too Large",
        detail: "too long",
      }),
      { status: 413 },
    );
    const promise = assembly.sync.transcribe(fakeWavBytes);
    await expect(promise).rejects.toThrow(SyncTranscriptError);
    await expect(promise).rejects.toMatchObject({
      message: "too long",
      status: 413,
      errorCode: "audio_too_large",
    });
  });

  it("should map a legacy error envelope to a SyncTranscriptError", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({ error_code: "audio_too_large", message: "too long" }),
      { status: 413 },
    );
    await expect(assembly.sync.transcribe(fakeWavBytes)).rejects.toMatchObject({
      message: "too long",
      status: 413,
      errorCode: "audio_too_large",
    });
  });

  it("should map a bare error/error_code envelope to a SyncTranscriptError", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        error: "Invalid API key",
        error_code: "unauthorized",
      }),
      { status: 401 },
    );
    await expect(assembly.sync.transcribe(fakeWavBytes)).rejects.toMatchObject({
      message: "Invalid API key",
      errorCode: "unauthorized",
    });
  });

  it("should prefer detail over a bare error field", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        detail: "detail wins",
        error: "error field",
        error_code: "x",
      }),
      { status: 400 },
    );
    await expect(assembly.sync.transcribe(fakeWavBytes)).rejects.toMatchObject({
      message: "detail wins",
    });
  });

  it("should prefer message over a bare error field", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        message: "message wins",
        error: "error field",
        error_code: "x",
      }),
      { status: 400 },
    );
    await expect(assembly.sync.transcribe(fakeWavBytes)).rejects.toMatchObject({
      message: "message wins",
    });
  });

  it("should surface retryAfter on rate limits", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        status: 429,
        title: "Too Many Requests",
        detail: "Too many requests",
      }),
      { status: 429, headers: { "Retry-After": "5" } },
    );
    await expect(assembly.sync.transcribe(fakeWavBytes)).rejects.toMatchObject({
      status: 429,
      errorCode: "too_many_requests",
      retryAfter: 5,
    });
  });

  it("should surface a rate-limited response and still upload the whole clip as a single chunk", async () => {
    // Drain the body inside the handler, the way a real transport does, so
    // the assertion does not race an early response against the writer
    // still producing the (single) audio chunk.
    let uploaded: Uint8Array | undefined;
    fetchMock.doMockOnceIf(
      requestMatches({ url: liveUrl, method: "POST" }),
      async () => {
        uploaded = await requestBodyBytes();
        return {
          body: JSON.stringify({
            status: 429,
            title: "Too Many Requests",
            detail: "slow down",
          }),
          init: { status: 429, headers: { "Retry-After": "7" } },
        };
      },
    );
    const error = await assembly.sync.transcribe(fakeWavBytes).catch((e) => e);
    expect(error).toBeInstanceOf(SyncTranscriptError);
    expect(error.status).toBe(429);
    expect(error.errorCode).toBe("too_many_requests");
    expect(error.retryAfter).toBe(7);

    // The "single chunk" half of the contract holds even on a rejected
    // request: one config part, then one audio part carrying the whole
    // input, then the closing boundary.
    const parts = parseParts(uploaded!);
    expect(parts.map((p) => p.name)).toEqual(["config", "audio"]);
    expect(decode(parts[0].body)).toBe("{}");
    expect(decode(parts[1].body)).toBe(decode(fakeWavBytes));

    const boundary = /boundary=([^;]+)/.exec(
      requestHeaders()["Content-Type"],
    )![1];
    const raw = new TextDecoder("latin1").decode(uploaded!);
    expect(raw.trimEnd().endsWith(`--${boundary}--`)).toBe(true);
  });

  it("should map a detail-only envelope without an error code", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ detail: "Invalid API key" }), {
      status: 401,
    });
    await expect(assembly.sync.transcribe(fakeWavBytes)).rejects.toMatchObject({
      message: "Invalid API key",
      status: 401,
      errorCode: undefined,
    });
  });

  it("should warm the connection with the model header", async () => {
    fetchMock.doMockOnceIf(requestMatches({ url: "/v1/warm", method: "GET" }));
    const warmed = await assembly.sync.warm();
    expect(warmed).toBe(true);
    expect(requestHeaders()["X-AAI-Model"]).toBe("universal-3-5-pro");
  });

  it("should warm with the provided model", async () => {
    fetchMock.doMockOnceIf(requestMatches({ url: "/v1/warm", method: "GET" }));
    await assembly.sync.warm({ model: "some-other-model" });
    expect(requestHeaders()["X-AAI-Model"]).toBe("some-other-model");
  });

  it("should return true from warm on a non-200 response", async () => {
    fetchMock.mockResponseOnce("", { status: 404 });
    expect(await assembly.sync.warm()).toBe(true);
  });

  it("should return false from warm on a transport error", async () => {
    fetchMock.mockRejectOnce(new TypeError("connection refused"));
    expect(await assembly.sync.warm()).toBe(false);
  });
});

describe("sync deadlines", () => {
  it("should honour an external abort signal on transcribe()", async () => {
    mockAbortable();
    const controller = new AbortController();
    const pending = assembly.sync.transcribe(
      fakeWavBytes,
      {},
      { signal: controller.signal },
    );
    controller.abort();
    await expect(pending).rejects.toThrow("aborted");
  });

  it("should give up once the timeout elapses on transcribe()", async () => {
    mockAbortable();
    await expect(
      assembly.sync.transcribe(fakeWavBytes, {}, { timeout: 1 }),
    ).rejects.toThrow("aborted");
  });
});
