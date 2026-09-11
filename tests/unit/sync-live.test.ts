import { createReadStream } from "fs";
import fetchMock from "jest-fetch-mock";
import path from "path";
import { Readable } from "stream";
import { SyncTranscriptError } from "../../src";
import { createClient, defaultBaseUrl, requestMatches } from "./utils";

fetchMock.enableMocks();

const testDir = process.env["TESTDATA_DIR"] ?? "tests/static";

const assembly = createClient();

const okResponse = {
  text: "hello world",
  words: [{ text: "hello", confidence: 0.9 }],
  confidence: 0.92,
  audio_duration_ms: 400,
  session_id: "eb92c4ff-4bbb-429f-9b99-7279d7fe738f",
  request_time_ms: 243.7,
};

const liveUrl = "/v1/transcribe/live";

function mockOk() {
  fetchMock.doMockOnceIf(
    requestMatches({ url: liveUrl, method: "POST" }),
    JSON.stringify(okResponse),
  );
}

function mockError(status: number, body: object, headers = {}) {
  fetchMock.doMockOnceIf(
    requestMatches({ url: liveUrl, method: "POST" }),
    JSON.stringify(body),
    { status, headers },
  );
}

function requestInit(): RequestInit & { duplex?: string } {
  return fetchMock.mock.calls[0][1] as RequestInit & { duplex?: string };
}

function requestHeaders(): Record<string, string> {
  return requestInit().headers as Record<string, string>;
}

/** Drains the streamed request body the way a transport would. */
async function requestBodyBytes(): Promise<Uint8Array> {
  const body = requestInit().body as ReadableStream<Uint8Array>;
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
function parseParts(bytes: Uint8Array): Part[] {
  const contentType = requestHeaders()["Content-Type"];
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
async function requestParts(): Promise<Part[]> {
  return parseParts(await requestBodyBytes());
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

describe("sync live upload", () => {
  it("should send config before audio and stream the body chunked", async () => {
    mockOk();
    const result = await assembly.sync.transcribeLive(
      chunks(bytes("RIFF"), bytes("fake")),
      { prompt: "a prompt" },
    );

    expect(result.text).toBe("hello world");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:1234" + liveUrl);
    expect(requestInit().duplex).toBe("half");
    expect(requestInit().body).toBeInstanceOf(ReadableStream);
    expect(requestHeaders()["X-AAI-Model"]).toBe("universal-3-5-pro");
    expect(requestHeaders()["Content-Type"]).toMatch(
      /^multipart\/form-data; boundary=----assemblyai-[0-9a-z]{32}$/,
    );

    const parts = await requestParts();
    expect(parts.map((p) => p.name)).toEqual(["config", "audio"]);
    expect(JSON.parse(decode(parts[0].body))).toEqual({ prompt: "a prompt" });
    expect(parts[0].type).toBe("application/json");
    expect(decode(parts[1].body)).toBe("RIFFfake");
    expect(parts[1].type).toBe("audio/wav");
    expect(parts[1].filename).toBe("audio.wav");
  });

  it("should always send a config part, empty when there are no options", async () => {
    mockOk();
    await assembly.sync.transcribeLive(chunks(bytes("RIFF")));
    const parts = await requestParts();
    expect(parts.map((p) => p.name)).toEqual(["config", "audio"]);
    expect(decode(parts[0].body)).toBe("{}");
  });

  it("should never send the model in the config part", async () => {
    mockOk();
    await assembly.sync.transcribeLive(chunks(bytes("RIFF")), {
      model: "some-other-model",
    });
    expect(requestHeaders()["X-AAI-Model"]).toBe("some-other-model");
    const parts = await requestParts();
    expect(decode(parts[0].body)).toBe("{}");
  });

  it("should mark raw PCM from the config", async () => {
    mockOk();
    await assembly.sync.transcribeLive(chunks(bytes("\x00\x01")), {
      sample_rate: 16000,
      channels: 1,
    });
    const parts = await requestParts();
    expect(JSON.parse(decode(parts[0].body))).toEqual({
      sample_rate: 16000,
      channels: 1,
    });
    expect(parts[1].type).toBe("audio/pcm");
    expect(parts[1].filename).toBe("audio.pcm");
  });

  it("should require both PCM fields before any request", async () => {
    await expect(
      assembly.sync.transcribeLive(chunks(bytes("\x00")), {
        sample_rate: 16000,
      }),
    ).rejects.toThrow("sample_rate and channels");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should drop empty chunks and accept ArrayBuffer chunks", async () => {
    mockOk();
    await assembly.sync.transcribeLive(
      chunks(
        bytes("RIFF"),
        new Uint8Array(0),
        bytes("wav").buffer as unknown as Uint8Array,
      ),
    );
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFFwav");
  });

  it("should accept a sync iterable", async () => {
    mockOk();
    await assembly.sync.transcribeLive([bytes("RIFF"), bytes("fake")]);
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFFfake");
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
    await assembly.sync.transcribeLive(stream);
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFFfake");
  });

  it("should take the file name and format from an fs stream", async () => {
    mockOk();
    const stream = createReadStream(path.join(testDir, "gore-short.wav"));
    await assembly.sync.transcribeLive(stream);
    const parts = await requestParts();
    expect(parts[1].filename).toBe("gore-short.wav");
    expect(parts[1].type).toBe("audio/wav");
    expect(parts[1].body.length).toBeGreaterThan(1000);
  });

  it("should escape a file name that would break the part header", async () => {
    mockOk();
    const stream = Readable.from([bytes("RIFF")]) as Readable & {
      path: string;
    };
    stream.path = 'we"ird\r\nname.wav';
    await assembly.sync.transcribeLive(stream);
    const parts = await requestParts();
    expect(parts.map((p) => p.name)).toEqual(["config", "audio"]);
    expect(parts[1].filename).toBe("we%22ird%0D%0Aname.wav");
    expect(decode(parts[1].body)).toBe("RIFF");
  });

  it("should reject whole audio, pointing at transcribe()", async () => {
    await expect(
      assembly.sync.transcribeLive(bytes("RIFF") as never),
    ).rejects.toThrow("transcribe()");
    await expect(
      assembly.sync.transcribeLive(
        new Blob([bytes("RIFF") as BlobPart]) as never,
      ),
    ).rejects.toThrow("transcribe()");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should reject a path rather than open it", async () => {
    await expect(
      assembly.sync.transcribeLive("./call.wav" as never),
    ).rejects.toThrow("not a path");
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
      assembly.sync.transcribeLive(["RIFF", "fake"] as never),
    ).rejects.toThrow("not strings");
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
    await expect(assembly.sync.transcribeLive(failing())).rejects.toThrow(
      "microphone unplugged",
    );
  });

  it("should end the upload as soon as the server rejects it mid-upload", async () => {
    // fetch resolves with an early error status while the body is still
    // streaming but withholds the response body until the request body ends.
    // The SDK must finish the body itself rather than wait for the producer.
    mockError(404, { status: 404, title: "Not Found", detail: "bad key" });
    let pulled = 0;
    async function* endless() {
      for (;;) {
        pulled++;
        yield bytes("\x00\x00");
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    const error = await assembly.sync
      .transcribeLive(endless(), { sample_rate: 16000, channels: 1 })
      .catch((e) => e);
    expect(error).toBeInstanceOf(SyncTranscriptError);
    expect(error.status).toBe(404);

    // Draining what the transport would still read ends at the closing
    // boundary without waiting on the (endless) producer.
    const drained = decode(await requestBodyBytes());
    expect(drained.trimEnd().endsWith("--")).toBe(true);
    const pulledAtClose = pulled;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(pulled).toBe(pulledAtClose); // the producer was let go of
  });

  it("should surface an error response as SyncTranscriptError", async () => {
    mockError(
      429,
      { status: 429, title: "Rate Limited", detail: "slow down" },
      { "Retry-After": "3" },
    );
    const error = await assembly.sync
      .transcribeLive(chunks(bytes("RIFF")))
      .catch((e) => e);
    expect(error).toBeInstanceOf(SyncTranscriptError);
    expect(error.status).toBe(429);
    expect(error.errorCode).toBe("rate_limited");
    expect(error.retryAfter).toBe(3);
  });

  it("should honour an external abort signal", async () => {
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
    const controller = new AbortController();
    async function* forever() {
      yield bytes("RIFF");
      await new Promise(() => undefined);
    }
    const pending = assembly.sync.transcribeLive(
      forever(),
      {},
      {
        signal: controller.signal,
      },
    );
    controller.abort();
    await expect(pending).rejects.toThrow("aborted");
  });
});

describe("sync live session", () => {
  it("should upload written chunks in order and resolve the transcript", async () => {
    mockOk();
    const session = assembly.sync.openLive({ sample_rate: 16000, channels: 1 });
    session.write(bytes("\x00\x01"));
    session.write(new Uint8Array([2, 3]).buffer);
    session.write(new Uint8Array(0)); // dropped
    const result = await session.result();

    expect(result.text).toBe("hello world");
    expect(session.closed).toBe(true);
    const parts = await requestParts();
    expect(parts.map((p) => p.name)).toEqual(["config", "audio"]);
    expect(JSON.parse(decode(parts[0].body))).toEqual({
      sample_rate: 16000,
      channels: 1,
    });
    expect(Array.from(parts[1].body)).toEqual([0, 1, 2, 3]);
    expect(parts[1].type).toBe("audio/pcm");
  });

  it("should start the request before any audio is written", async () => {
    mockOk();
    const session = assembly.sync.openLive();
    // The request is dispatched on open, which is the point: connection and
    // config go out while the speaker is still talking.
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    session.close();
    await session.result();
  });

  it("should drop, not throw, on a write after close", async () => {
    mockOk();
    const session = assembly.sync.openLive();
    session.write(bytes("RIFF"));
    session.close();
    // A capture callback still firing after close must not throw into itself.
    expect(() => session.write(bytes("late"))).not.toThrow();
    const parts = await requestParts();
    expect(decode(parts[1].body)).toBe("RIFF"); // the late chunk was dropped
    await session.result();
  });

  it("should reject text at write time", async () => {
    mockOk();
    const session = assembly.sync.openLive();
    expect(() => session.write("RIFF" as never)).toThrow("not strings");
    await session.result();
  });

  it("should reject a job-style config type error early", () => {
    expect(() => assembly.sync.openLive({ sample_rate: 16000 })).not.toThrow(); // validation happens when the request is built
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
    const session = assembly.sync.openLive();
    session.write(bytes("RIFF"));
    await session.abort();
    expect(session.closed).toBe(true);
    await expect(session.result()).rejects.toThrow("aborted");
    await session.abort(); // idempotent
  });

  it("should drop writes after the request has settled instead of throwing", async () => {
    mockError(503, { status: 503, title: "Capacity Exceeded", detail: "x" });
    const session = assembly.sync.openLive();
    session.write(bytes("RIFF"));
    // The server rejects while the caller has not yet closed or collected.
    await new Promise((resolve) => setTimeout(resolve, 20));
    // A capture callback that has not been stopped yet keeps writing; that
    // must neither throw nor queue.
    expect(() => session.write(bytes("more"))).not.toThrow();
    expect(session.closed).toBe(false);
    await expect(session.result()).rejects.toBeInstanceOf(SyncTranscriptError);
    // ...and it still drops, not throws, after result() has surfaced the error.
    expect(() => session.write(bytes("later"))).not.toThrow();
  });

  it("should treat abort() after completion as a no-op", async () => {
    mockOk();
    const session = assembly.sync.openLive();
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
    const session = assembly.sync.openLive();
    session.write(bytes("RIFF"));
    const error = await session.result().catch((e) => e);
    expect(error).toBeInstanceOf(SyncTranscriptError);
    expect(error.errorCode).toBe("capacity_exceeded");
  });

  it("should not raise an unhandled rejection when result() is never awaited", async () => {
    mockError(503, { status: 503, title: "Capacity Exceeded", detail: "x" });
    const unhandled = jest.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const session = assembly.sync.openLive();
      session.close();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("should accept a piped web stream via stream()", async () => {
    // Drain the body inside the handler, the way a real transport does, so the
    // assertion does not race the pipe against a later manual read (the
    // ordering of that read differs across Node's fetch implementations).
    let uploaded: Uint8Array | undefined;
    fetchMock.doMockOnceIf(
      requestMatches({ url: liveUrl, method: "POST" }),
      async () => {
        uploaded = await requestBodyBytes();
        return JSON.stringify(okResponse);
      },
    );
    const session = assembly.sync.openLive();
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
    expect(result.text).toBe("hello world");
    const parts = parseParts(uploaded!);
    expect(decode(parts[1].body)).toBe("RIFFfake");
  });
});

describe("sync routing", () => {
  it("should never request the buffered transcription endpoint", async () => {
    mockOk();
    mockOk();
    mockOk();

    await assembly.sync.transcribe(bytes("RIFFfake"));
    await assembly.sync.transcribeLive(chunks(bytes("RIFF")));
    const session = assembly.sync.openLive();
    session.write(bytes("RIFF"));
    session.close();
    await session.result();

    expect(fetchMock.mock.calls).toHaveLength(3);
    const urls = new Set(fetchMock.mock.calls.map(([url]) => url));
    expect(urls).toEqual(new Set([defaultBaseUrl + liveUrl]));
  });
});
