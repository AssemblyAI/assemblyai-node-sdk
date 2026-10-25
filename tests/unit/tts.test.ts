import { getEventListeners } from "events";
import fetchMock from "jest-fetch-mock";
import { AssemblyAI, TextToSpeechError } from "../../src";
import { createClient, defaultApiKey, requestMatches } from "./utils";

fetchMock.enableMocks();

const audio = new Uint8Array(960).map((_, i) => i % 7);
const okHeaders = {
  "content-type": "audio/pcm;rate=24000;channels=1",
  "x-request-id": "req-1",
  "x-tts-region": "us-east-1",
  "x-tts-model": "assemblyai-tts-1",
  "x-tts-voice-id": "aai-jane",
  "x-tts-language": "english",
  "x-tts-encoding": "pcm_s16le",
  "x-tts-sample-rate": "24000",
  "x-tts-container": "raw",
  "x-tts-billed-characters": "12",
  "x-tts-audio-duration-ms": "20",
};

let client: AssemblyAI;

const mockAudio = (headers: Record<string, string> = okHeaders) =>
  fetchMock.doMockOnceIf(
    requestMatches({ url: "/v1/speech", method: "POST" }),
    () =>
      Promise.resolve({
        status: 200,
        headers,
        body: Buffer.from(audio) as unknown as string,
      }),
  );

const sentBody = (call = 0) =>
  JSON.parse(fetchMock.mock.calls[call][1]!.body as string);

describe("tts", () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    fetchMock.doMock();
    client = createClient();
  });

  it("synthesize posts a buffered request and returns the audio with its headers", async () => {
    mockAudio();
    const response = await client.tts.synthesize({ text: "Hello there." });
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:1234/v1/speech");
    const init = fetchMock.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      defaultApiKey,
    );
    expect(sentBody()).toEqual({ text: "Hello there.", stream: false });
    expect(Buffer.from(response.audio)).toEqual(Buffer.from(audio));
    expect(response).toMatchObject({
      requestId: "req-1",
      region: "us-east-1",
      model: "assemblyai-tts-1",
      voiceId: "aai-jane",
      language: "english",
      encoding: "pcm_s16le",
      sampleRate: 24000,
      container: "raw",
      billedCharacters: 12,
      audioDurationMs: 20,
    });
    expect(response.bitRate).toBeUndefined();
  });

  it("sends the request fields as given", async () => {
    mockAudio();
    await client.tts.synthesize({
      text: "Hola.",
      voice_id: "aai-juan",
      model_id: "assemblyai-tts-1",
      sample_rate: 8000,
      encoding: "pcm_mulaw",
      container: "wav",
    });
    expect(sentBody()).toEqual({
      text: "Hola.",
      voice_id: "aai-juan",
      model_id: "assemblyai-tts-1",
      sample_rate: 8000,
      encoding: "pcm_mulaw",
      container: "wav",
      stream: false,
    });
  });

  it("derives the voice id from X-TTS-Voice until the API sends X-TTS-Voice-Id", async () => {
    const legacy = { ...okHeaders };
    delete (legacy as Record<string, string>)["x-tts-voice-id"];
    mockAudio({ ...legacy, "x-tts-voice": "jane" });
    mockAudio({ ...legacy, "x-tts-voice": "custom" });
    expect((await client.tts.synthesize({ text: "Hi." })).voiceId).toBe(
      "aai-jane",
    );
    expect(
      (await client.tts.synthesize({ text: "Hi.", voice_id: "aai-isaiah-2" }))
        .voiceId,
    ).toBe("aai-isaiah-2");
  });

  it("stream asks for a streamed response and yields the body", async () => {
    mockAudio();
    const speech = await client.tts.stream({ text: "Hello there." });
    expect(sentBody()).toEqual({ text: "Hello there.", stream: true });
    expect(speech.info.model).toBe("assemblyai-tts-1");
    const chunks: Uint8Array[] = [];
    for await (const chunk of speech) chunks.push(chunk);
    expect(Buffer.concat(chunks.map((c) => Buffer.from(c)))).toEqual(
      Buffer.from(audio),
    );
  });

  it("stream bytes() collects the whole audio", async () => {
    mockAudio();
    const speech = await client.tts.stream({ text: "Hello there." });
    expect(Buffer.from(await speech.bytes())).toEqual(Buffer.from(audio));
  });

  it("maps the error envelope to a TextToSpeechError", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v1/speech", method: "POST" }),
      () =>
        Promise.resolve({
          status: 422,
          headers: {
            "content-type": "application/json",
            "x-request-id": "req-2",
          },
          body: JSON.stringify({
            code: "invalid_parameter",
            message: "sample_rate: not in supported set",
            param: "sample_rate",
            request_id: "req-2",
            errors: [{ message: "not in supported set", param: "sample_rate" }],
            retryable: false,
            retry_after_seconds: null,
          }),
        }),
    );
    const promise = client.tts.synthesize({
      text: "Hi.",
      sample_rate: 12345 as never,
    });
    await expect(promise).rejects.toBeInstanceOf(TextToSpeechError);
    const error = (await promise.catch((e) => e)) as TextToSpeechError;
    expect(error.message).toBe("sample_rate: not in supported set");
    expect(error).toMatchObject({
      status: 422,
      errorCode: "invalid_parameter",
      param: "sample_rate",
      requestId: "req-2",
      retryable: false,
    });
    expect(error.errors).toEqual([
      { message: "not in supported set", param: "sample_rate" },
    ]);
    expect(error.body?.code).toBe("invalid_parameter");
  });

  it("reads Retry-After and rounds a fractional hint up", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v1/speech", method: "POST" }),
      () =>
        Promise.resolve({
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "17" },
          body: JSON.stringify({
            code: "rate_limited",
            message: "slow down",
            retryable: true,
            retry_after_seconds: 1.2,
          }),
        }),
    );
    const error = (await client.tts
      .stream({ text: "Hi." })
      .catch((e) => e)) as TextToSpeechError;
    expect(error.errorCode).toBe("rate_limited");
    expect(error.retryable).toBe(true);
    expect(error.retryAfter).toBe(2);
  });

  it("reports a non-JSON answer by its status and text", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v1/speech", method: "POST" }),
      () =>
        Promise.resolve({
          status: 502,
          headers: { "content-type": "text/html" },
          body: "<html>502 Bad Gateway</html>",
        }),
    );
    const error = (await client.tts
      .synthesize({ text: "Hi." })
      .catch((e) => e)) as TextToSpeechError;
    expect(error.status).toBe(502);
    expect(error.errorCode).toBeUndefined();
    expect(error.retryable).toBe(true);
    expect(error.message).toContain("Bad Gateway");
  });

  it("uses the ttsBaseUrl of the client", async () => {
    const eu = new AssemblyAI({
      apiKey: "k",
      ttsBaseUrl: "https://tts.eu.assemblyai.com/",
    });
    fetchMock.doMockOnceIf(
      (req) => req.url === "https://tts.eu.assemblyai.com/v1/speech",
      () =>
        Promise.resolve({
          status: 200,
          headers: okHeaders,
          body: Buffer.from(audio) as unknown as string,
        }),
    );
    const response = await eu.tts.synthesize({ text: "Hallo." });
    expect(response.audio.byteLength).toBe(audio.byteLength);
  });

  it("mints a temporary token on the token host", async () => {
    fetchMock.doMockOnceIf(
      (req) =>
        req.url ===
        "https://token.assemblyai.com/v1/token?product=tts&expires_in_seconds=60",
      JSON.stringify({ token: "tmp-token", expires_in_seconds: 60 }),
    );
    expect(
      await client.tts.createTemporaryToken({ expires_in_seconds: 60 }),
    ).toBe("tmp-token");
  });

  it.each([
    {
      ttsBaseUrl: "https://tts.eu.assemblyai.com/",
      tokenHost: "https://token.eu.assemblyai.com",
    },
    {
      ttsBaseUrl: "https://streaming-tts.eu.assemblyai.com",
      tokenHost: "https://token.eu.assemblyai.com",
    },
    {
      ttsBaseUrl: "https://tts.us.assemblyai.com",
      tokenHost: "https://token.us.assemblyai.com",
    },
    { ttsBaseUrl: undefined, tokenHost: "https://token.us.assemblyai.com" },
    {
      ttsBaseUrl: "https://tts.example.com",
      tokenHost: "https://token.assemblyai.com",
    },
  ])(
    "mints the token in the zone of ttsBaseUrl $ttsBaseUrl",
    async ({ ttsBaseUrl, tokenHost }) => {
      const zoned = new AssemblyAI({ apiKey: "k", ttsBaseUrl });
      fetchMock.mockResponseOnce(
        JSON.stringify({ token: "zone-token", expires_in_seconds: 60 }),
      );
      expect(
        await zoned.tts.createTemporaryToken({ expires_in_seconds: 60 }),
      ).toBe("zone-token");
      expect(fetchMock.mock.calls[0][0]).toBe(
        `${tokenHost}/v1/token?product=tts&expires_in_seconds=60`,
      );
    },
  );

  it("an explicit tokenBaseUrl wins over the client's zone", async () => {
    const eu = new AssemblyAI({
      apiKey: "k",
      ttsBaseUrl: "https://tts.eu.assemblyai.com",
    });
    fetchMock.mockResponseOnce(
      JSON.stringify({ token: "own-token", expires_in_seconds: 60 }),
    );
    expect(
      await eu.tts.createTemporaryToken(
        { expires_in_seconds: 60 },
        { tokenBaseUrl: "https://token.example.com/" },
      ),
    ).toBe("own-token");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://token.example.com/v1/token?product=tts&expires_in_seconds=60",
    );
  });

  it("leaving a stream early cancels the body", async () => {
    const { TextToSpeechStream } = await import(
      "../../src/services/tts/service"
    );
    const cancelled = jest.fn();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array([pulls]));
      },
      cancel: cancelled,
    });
    const speech = new TextToSpeechStream({ requestId: "r" }, body);
    for await (const chunk of speech) {
      if (chunk[0] === 2) break; // a barge-in after two chunks
    }
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  /** Answers the next fetch with a real web stream as the body. */
  const mockStreamedBody = (
    body: ReadableStream<Uint8Array>,
    headers: Record<string, string> = okHeaders,
  ) =>
    fetchMock.mockImplementationOnce(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers(headers),
          body,
        }) as unknown as Response,
    );

  /** The test audio as a web stream of two chunks. */
  const audioSource = () =>
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(audio.slice(0, 480));
        c.enqueue(audio.slice(480));
        c.close();
      },
    });

  it("stream turns a body cut after the first audio into a retryable TextToSpeechError", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array([1, 2, 3, 4]));
      },
      pull(c) {
        c.error(new TypeError("terminated"));
      },
    });
    fetchMock.mockImplementationOnce(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers({ "x-request-id": "req-cut" }),
          body,
        }) as unknown as Response,
    );
    const speech = await client.tts.stream({ text: "Hi." });
    const chunks: Uint8Array[] = [];
    const error = await (async () => {
      try {
        for await (const c of speech) chunks.push(c);
      } catch (e) {
        return e;
      }
    })();
    expect(chunks).toHaveLength(1);
    expect(error).toBeInstanceOf(TextToSpeechError);
    expect(error).toMatchObject({
      status: 200,
      retryable: true,
      requestId: "req-cut",
    });
  });

  it("stream locks the response body as soon as the headers arrive", async () => {
    // Node 20+ fetch cancels the body of a garbage-collected Response only
    // while that body is unlocked, so a locked one keeps its audio.
    const source = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(audio.subarray(0, 480));
        c.enqueue(audio.subarray(480));
        c.close();
      },
    });
    mockStreamedBody(source);
    const speech = await client.tts.stream({ text: "Hello there." });
    expect(source.locked).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 5)); // the caller awaits something else first
    expect(speech.info.requestId).toBe("req-1");
    expect(Buffer.from(await speech.bytes())).toEqual(Buffer.from(audio));
  });

  it("stream cancel() from outside a running loop ends it and cancels the body", async () => {
    const sourceCancelled = jest.fn();
    let sent = false;
    const source = new ReadableStream<Uint8Array>(
      {
        pull(c) {
          if (sent) return new Promise<void>(() => undefined); // the rest of the audio never arrives
          sent = true;
          c.enqueue(new Uint8Array([1, 2, 3, 4]));
        },
        cancel: sourceCancelled,
      },
      { highWaterMark: 0 },
    );
    mockStreamedBody(source);
    const speech = await client.tts.stream({ text: "Hello there." });
    const chunks: Uint8Array[] = [];
    let firstChunk!: () => void;
    const gotFirst = new Promise<void>((resolve) => (firstChunk = resolve));
    const loop = (async () => {
      for await (const chunk of speech) {
        chunks.push(chunk);
        firstChunk();
      }
    })();
    await gotFirst;
    await speech.cancel(); // a barge-in callback while the loop waits for audio
    await loop;
    expect(chunks).toHaveLength(1);
    expect(sourceCancelled).toHaveBeenCalledTimes(1);
  });

  it("stream cancel() before any read cancels the body", async () => {
    const sourceCancelled = jest.fn();
    const source = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
      cancel: sourceCancelled,
    });
    mockStreamedBody(source);
    const speech = await client.tts.stream({ text: "Hello there." });
    await speech.cancel();
    expect(sourceCancelled).toHaveBeenCalledTimes(1);
    const chunks: Uint8Array[] = [];
    for await (const chunk of speech) chunks.push(chunk);
    expect(chunks).toHaveLength(0);
  });

  it.each([
    ["a streamed body", () => mockStreamedBody(audioSource())],
    ["a whole body", () => mockAudio()],
  ])(
    "a stream timeout covers the headers, not %s",
    async (_name, mockResponse) => {
      jest.useFakeTimers();
      try {
        mockResponse();
        const speech = await client.tts.stream(
          { text: "Hi." },
          { timeout: 10 },
        );
        jest.advanceTimersByTime(50); // well past the timeout, after the headers arrived
        expect(
          (fetchMock.mock.calls[0][1]!.signal as AbortSignal).aborted,
        ).toBe(false);
        expect(Buffer.from(await speech.bytes())).toEqual(Buffer.from(audio));
      } finally {
        jest.useRealTimers();
      }
    },
  );

  /**
   * A web stream that sends one chunk and then nothing, as a body whose
   * connection stalls without a reset; `cancelled` records its cancel.
   */
  const stallingSource = () => {
    const cancelled = jest.fn();
    let sent = false;
    const source = new ReadableStream<Uint8Array>(
      {
        pull(c) {
          if (sent) return new Promise<void>(() => undefined);
          sent = true;
          c.enqueue(new Uint8Array([1, 2, 3, 4]));
        },
        cancel: cancelled,
      },
      { highWaterMark: 0 },
    );
    return { source, cancelled };
  };

  it.each([
    ["the default 30 s", {}, 30_000],
    ["its readTimeout", { readTimeout: 5_000 }, 5_000],
  ])(
    "stream gives up a body that stalls after the first audio after %s, as a retryable cut, and releases the connection",
    async (_name, options, limit) => {
      jest.useFakeTimers();
      try {
        const { source, cancelled } = stallingSource();
        mockStreamedBody(source);
        const speech = await client.tts.stream({ text: "Hi." }, options);
        const chunks: Uint8Array[] = [];
        let error: unknown;
        const loop = (async () => {
          for await (const chunk of speech) chunks.push(chunk);
        })().catch((e) => {
          error = e;
        });
        await jest.advanceTimersByTimeAsync(limit - 1);
        expect(chunks).toHaveLength(1);
        expect(error).toBeUndefined();
        expect(cancelled).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
        await loop;
        expect(error).toBeInstanceOf(TextToSpeechError);
        expect(error).toMatchObject({
          status: 200,
          retryable: true,
          requestId: "req-1",
        });
        expect((error as Error).message).toContain(`no audio for ${limit} ms`);
        expect(cancelled).toHaveBeenCalledTimes(1); // the connection is released
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it("stream bounds a read of body with the caller's own reader too", async () => {
    jest.useFakeTimers();
    try {
      const { source, cancelled } = stallingSource();
      mockStreamedBody(source);
      const speech = await client.tts.stream(
        { text: "Hi." },
        { readTimeout: 1_000 },
      );
      const reader = speech.body.getReader();
      expect((await reader.read()).value).toEqual(new Uint8Array([1, 2, 3, 4]));
      const next = reader.read().catch((e) => e);
      await jest.advanceTimersByTimeAsync(1_000);
      expect(await next).toMatchObject({
        name: "TextToSpeechError",
        status: 200,
        retryable: true,
      });
      expect(cancelled).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("stream never times a caller that plays each chunk at its own pace", async () => {
    jest.useFakeTimers();
    try {
      let pulls = 0;
      const source = new ReadableStream<Uint8Array>(
        {
          pull(c) {
            pulls++;
            c.enqueue(audio.slice((pulls - 1) * 320, pulls * 320));
            if (pulls === 3) c.close();
          },
        },
        { highWaterMark: 0 },
      );
      mockStreamedBody(source);
      const speech = await client.tts.stream(
        { text: "Hi." },
        { readTimeout: 1_000 },
      );
      const chunks: Uint8Array[] = [];
      for await (const chunk of speech) {
        chunks.push(chunk);
        await jest.advanceTimersByTimeAsync(60_000); // playing the chunk takes a minute
      }
      expect(Buffer.concat(chunks)).toEqual(Buffer.from(audio));
      expect(jest.getTimerCount()).toBe(0); // no read timer outlives its read
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    [0, 0],
    [Infinity, 0],
    [Number.MAX_SAFE_INTEGER, 1], // past setTimeout's range, where a timer fires at once
  ])(
    "stream with readTimeout %p waits for a stalled body until cancelled",
    async (readTimeout, timers) => {
      jest.useFakeTimers();
      try {
        const { source, cancelled } = stallingSource();
        mockStreamedBody(source);
        const speech = await client.tts.stream(
          { text: "Hi." },
          { readTimeout },
        );
        const chunks: Uint8Array[] = [];
        let settled = false;
        let error: unknown;
        const loop = (async () => {
          for await (const chunk of speech) chunks.push(chunk);
        })().then(
          () => (settled = true),
          (e) => {
            error = e;
            settled = true;
          },
        );
        await jest.advanceTimersByTimeAsync(3_600_000);
        expect(chunks).toHaveLength(1);
        expect(settled).toBe(false);
        expect(jest.getTimerCount()).toBe(timers);
        expect(cancelled).not.toHaveBeenCalled();
        await speech.cancel();
        await loop;
        expect(error).toBeUndefined();
        expect(cancelled).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    },
  );

  /**
   * Answers the next fetch the way fetch does: once the request's signal
   * aborts, the body errors with the signal's reason. The body sends `total`
   * one-byte chunks, then ends, or with `hang` waits forever for more.
   */
  const mockAbortableBody = (total: number, { hang = false } = {}) => {
    const source = { sent: 0, signal: undefined as AbortSignal | undefined };
    fetchMock.mockImplementationOnce(async (_input, init) => {
      const signal = init!.signal!;
      source.signal = signal;
      const body = new ReadableStream<Uint8Array>(
        {
          start(c) {
            signal.addEventListener("abort", () => c.error(signal.reason), {
              once: true,
            });
          },
          pull(c) {
            if (source.sent === total) {
              if (hang) return new Promise<void>(() => undefined);
              return c.close();
            }
            source.sent++;
            c.enqueue(new Uint8Array([source.sent]));
          },
        },
        { highWaterMark: 0 },
      );
      return {
        ok: true,
        status: 200,
        headers: new Headers(okHeaders),
        body,
      } as unknown as Response;
    });
    return source;
  };

  /** Runs `loop` and returns what it threw, if anything. */
  const thrownBy = async (loop: () => Promise<void>) => {
    try {
      await loop();
    } catch (e) {
      return e;
    }
  };

  it("stream stops at the caller's abort after the first chunk, as an AbortError and not a cut", async () => {
    const source = mockAbortableBody(50);
    const controller = new AbortController();
    const speech = await client.tts.stream(
      { text: "Hi." },
      { signal: controller.signal },
    );
    const chunks: Uint8Array[] = [];
    const error = await thrownBy(async () => {
      for await (const chunk of speech) {
        chunks.push(chunk);
        controller.abort(); // a barge-in
      }
    });
    expect(chunks).toHaveLength(1);
    expect(error).not.toBeInstanceOf(TextToSpeechError);
    expect((error as Error).name).toBe("AbortError");
    expect(source.signal!.aborted).toBe(true); // the download itself stopped
    expect(source.sent).toBe(1);
  });

  it("stream ends a read that waits for audio at the caller's abort", async () => {
    mockAbortableBody(1, { hang: true });
    const controller = new AbortController();
    const speech = await client.tts.stream(
      { text: "Hi." },
      { signal: controller.signal },
    );
    const chunks: Uint8Array[] = [];
    const error = await thrownBy(async () => {
      for await (const chunk of speech) {
        chunks.push(chunk);
        setTimeout(() => controller.abort(new Error("barge-in")), 5);
      }
    });
    expect(chunks).toHaveLength(1);
    expect(error).toEqual(new Error("barge-in"));
  });

  it("stream ends at an abort before the first read even when the audio is already here", async () => {
    mockAudio(); // a body read whole, as on runtimes without streamed bodies
    const controller = new AbortController();
    const speech = await client.tts.stream(
      { text: "Hi." },
      { signal: controller.signal },
    );
    controller.abort();
    const chunks: Uint8Array[] = [];
    const error = await thrownBy(async () => {
      for await (const chunk of speech) chunks.push(chunk);
    });
    expect(chunks).toHaveLength(0);
    expect((error as Error).name).toBe("AbortError");
  });

  /** A fetch that never answers and rejects with its signal's reason, as fetch does. */
  const mockNoAnswer = () =>
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init!.signal!;
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );

  it("stream and synthesize time out with the same TimeoutError", async () => {
    mockNoAnswer();
    mockNoAnswer();
    const errors = await Promise.all([
      client.tts.stream({ text: "Hi." }, { timeout: 20 }).catch((e) => e),
      client.tts.synthesize({ text: "Hi." }, { timeout: 20 }).catch((e) => e),
    ]);
    for (const error of errors) {
      expect(error).toBeInstanceOf(DOMException);
      expect(error.name).toBe("TimeoutError");
      expect(error.message).toBe("no audio within 20 ms");
    }
  });

  it("synthesize calls sharing one signal leave no listener on it", async () => {
    const controller = new AbortController();
    for (let i = 0; i < 13; i++) {
      mockAudio();
      await client.tts.synthesize(
        { text: "Hi." },
        { signal: controller.signal },
      );
    }
    fetchMock.mockResponseOnce("busy", { status: 503 });
    await client.tts
      .synthesize({ text: "Hi." }, { signal: controller.signal })
      .catch(() => undefined);
    fetchMock.mockRejectOnce(new TypeError("fetch failed"));
    await client.tts
      .synthesize({ text: "Hi." }, { signal: controller.signal })
      .catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(15);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("stream calls sharing one signal leave no listener on it, however they end", async () => {
    const controller = new AbortController();
    const signal = controller.signal;
    const listeners = () => getEventListeners(signal, "abort").length;

    mockStreamedBody(audioSource()); // read to the end
    await (await client.tts.stream({ text: "Hi." }, { signal })).bytes();
    mockStreamedBody(audioSource()); // read to the end with the caller's own reader
    const own = (await client.tts.stream({ text: "Hi." }, { signal })).body;
    const reader = own.getReader();
    while (!(await reader.read()).done);
    mockStreamedBody(audioSource()); // left early
    for await (const chunk of await client.tts.stream(
      { text: "Hi." },
      { signal },
    )) {
      if (chunk) break;
    }
    mockStreamedBody(audioSource()); // cancelled before any read
    const cancelled = await client.tts.stream({ text: "Hi." }, { signal });
    expect(listeners()).toBe(1); // a body nobody has read yet still listens
    await cancelled.cancel();
    mockStreamedBody(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new Uint8Array([1, 2]));
        },
        pull(c) {
          c.error(new TypeError("terminated"));
        },
      }),
    ); // cut
    await (await client.tts.stream({ text: "Hi." }, { signal }))
      .bytes()
      .catch(() => undefined);
    mockStreamedBody(stallingSource().source); // stalled past its read timeout
    await (await client.tts.stream({ text: "Hi." }, { signal, readTimeout: 5 }))
      .bytes()
      .catch(() => undefined);
    mockAudio(); // a body read whole
    await (await client.tts.stream({ text: "Hi." }, { signal })).bytes();
    fetchMock.mockResponseOnce("busy", { status: 503 }); // refused
    await client.tts.stream({ text: "Hi." }, { signal }).catch(() => undefined);
    fetchMock.mockRejectOnce(new TypeError("fetch failed")); // no answer
    await client.tts.stream({ text: "Hi." }, { signal }).catch(() => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(listeners()).toBe(0);
  });
});
