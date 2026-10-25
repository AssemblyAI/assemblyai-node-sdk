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

  it("a stream timeout covers the headers, not the body", async () => {
    jest.useFakeTimers();
    try {
      fetchMock.doMockOnceIf(
        requestMatches({ url: "/v1/speech", method: "POST" }),
        () =>
          Promise.resolve({
            status: 200,
            headers: okHeaders,
            body: Buffer.from(audio) as unknown as string,
          }),
      );
      const speech = await client.tts.stream({ text: "Hi." }, { timeout: 10 });
      jest.advanceTimersByTime(50); // well past the timeout, after the headers arrived
      expect(Buffer.from(await speech.bytes())).toEqual(Buffer.from(audio));
    } finally {
      jest.useRealTimers();
    }
  });
});
