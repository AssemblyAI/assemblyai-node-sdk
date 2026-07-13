import { createReadStream } from "fs";
import fetchMock from "jest-fetch-mock";
import path from "path";
import { SyncTranscriptError } from "../../src";
import { createClient, requestMatches } from "./utils";

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

function mockOk() {
  fetchMock.doMockOnceIf(
    requestMatches({ url: "/v1/transcribe", method: "POST" }),
    JSON.stringify(okResponse),
  );
}

type NamedBlob = Blob & { name?: string };

function requestBody(): FormData {
  return fetchMock.mock.calls[0][1]!.body as FormData;
}

function requestHeaders(): Record<string, string> {
  return fetchMock.mock.calls[0][1]!.headers as Record<string, string>;
}

async function configPart(): Promise<Record<string, unknown> | null> {
  const part = requestBody().get("config");
  if (part === null) return null;
  return JSON.parse(await (part as Blob).text());
}

beforeEach(() => {
  fetchMock.resetMocks();
  fetchMock.doMock();
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
      requestMatches({ url: "/v1/transcribe", method: "POST" }),
      JSON.stringify(response),
    );
    const result = await assembly.sync.transcribe(fakeWavBytes);
    expect(result.request_time_ms).toBeUndefined();
  });

  it("should send the model header and a WAV part", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes);
    expect(requestHeaders()["X-AAI-Model"]).toBe("universal-3-5-pro");
    const audio = requestBody().get("audio") as Blob;
    expect(audio.type).toBe("audio/wav");
    expect(requestBody().get("config")).toBeNull();
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

  it("should omit the config part when only the model is set", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, {
      model: "some-other-model",
    });
    expect(requestBody().get("config")).toBeNull();
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
      conversation_context: ["a".repeat(3000), "b".repeat(3000)],
    });
    const config = await configPart();
    expect(config?.conversation_context).toEqual(["b".repeat(3000)]);
  });

  it("should trim the oldest conversation turns over the turn cap", async () => {
    mockOk();
    const turns = Array.from({ length: 120 }, (_, i) => `turn ${i}`);
    await assembly.sync.transcribe(fakeWavBytes, {
      conversation_context: turns,
    });
    const config = await configPart();
    expect(config?.conversation_context).toEqual(turns.slice(20));
  });

  it("should trim to nothing when a single turn is over the char cap", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes, {
      conversation_context: ["a".repeat(5000)],
    });
    expect(requestBody().get("config")).toBeNull();
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

  it("should omit the config part for a default config", async () => {
    mockOk();
    await assembly.sync.transcribe(fakeWavBytes);
    expect(requestBody().get("config")).toBeNull();
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
      requestMatches({ url: "/v1/transcribe", method: "POST" }),
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
    const audio = requestBody().get("audio") as Blob;
    expect(audio.type).toBe("audio/pcm");
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
    const audio = requestBody().get("audio") as NamedBlob;
    expect(audio.name).toBe("gore-short.wav");
    expect(audio.type).toBe("audio/wav");
  });

  it("should transcribe a Node stream and use its file name", async () => {
    mockOk();
    const stream = createReadStream(path.join(testDir, "gore-short.wav"));
    const result = await assembly.sync.transcribe(stream);
    expect(result.text).toBe("hello world");
    const audio = requestBody().get("audio") as NamedBlob;
    expect(audio.name).toBe("gore-short.wav");
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
    const audio = requestBody().get("audio") as NamedBlob;
    expect(audio.name).toBe("call.wav");
  });

  it("should reject an oversized keyterms_prompt", async () => {
    await expect(
      assembly.sync.transcribe(fakeWavBytes, {
        keyterms_prompt: ["x".repeat(3000)],
      }),
    ).rejects.toThrow("keyterms_prompt exceeds");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should reject an oversized prompt", async () => {
    await expect(
      assembly.sync.transcribe(fakeWavBytes, { prompt: "x".repeat(5000) }),
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
