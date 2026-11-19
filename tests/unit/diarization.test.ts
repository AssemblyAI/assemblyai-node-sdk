import { mkdtempSync, rmSync, writeFileSync } from "fs";
import fetchMock from "jest-fetch-mock";
import { tmpdir } from "os";
import path from "path";
import { Readable } from "stream";
import {
  AssemblyAI,
  DiarizationError,
  DiarizationResponse,
  SyncTranscriptResponse,
} from "../../src";
import { defaultApiKey, defaultBaseUrl, requestMatches } from "./utils";

fetchMock.enableMocks();

const assembly = new AssemblyAI({
  baseUrl: defaultBaseUrl,
  diarizationBaseUrl: defaultBaseUrl,
  apiKey: defaultApiKey,
});

const diarizeUrl = "/v1/diarize";

const segmentsOnly: DiarizationResponse = {
  words: [],
  utterances: [],
  segments: [
    { start: 0, end: 4200, speaker: "A", speaker_confidence: 0.93 },
    { start: 4350, end: 9100, speaker: "B", speaker_confidence: 0.88 },
  ],
  speakers: ["A", "B"],
  audio_duration_ms: 9500,
  session_id: "eb92c4ff-4bbb-429f-9b99-7279d7fe738f",
  request_time_ms: 312.4,
};

const labelled: DiarizationResponse = {
  ...segmentsOnly,
  words: [
    { text: "hi", start: 0, end: 300, confidence: 0.9, speaker: "A" },
    { text: "hey", start: 4400, end: 4700, speaker: "B" },
  ],
  utterances: [
    {
      speaker: "A",
      start: 0,
      end: 300,
      text: "hi",
      confidence: 0.9,
      words: [{ text: "hi", start: 0, end: 300, speaker: "A" }],
    },
  ],
};

function mockResponse(body: object, status = 200, headers = {}) {
  fetchMock.doMockOnceIf(
    requestMatches({ url: diarizeUrl, method: "POST" }),
    JSON.stringify(body),
    { status, headers },
  );
}

function requestInit(): RequestInit {
  return fetchMock.mock.calls[0][1] as RequestInit;
}

function requestHeaders(): Record<string, string> {
  return requestInit().headers as Record<string, string>;
}

type Part = { name: string; filename?: string; type?: string; body: string };

/** Parses the buffered multipart request body into its parts, in order. */
function requestParts(): Part[] {
  const body = requestInit().body;
  expect(body).toBeInstanceOf(Uint8Array);
  const boundary = /boundary=([^;]+)/.exec(
    requestHeaders()["Content-Type"],
  )![1];
  const text = new TextDecoder("latin1").decode(body as Uint8Array);
  const parts: Part[] = [];
  for (const raw of text.split(`--${boundary}`)) {
    if (raw === "" || raw.startsWith("--")) continue;
    const [headerText, ...rest] = raw.replace(/^\r\n/, "").split("\r\n\r\n");
    parts.push({
      name: /name="([^"]*)"/.exec(headerText)![1],
      filename: /filename="([^"]*)"/.exec(headerText)?.[1],
      type: /Content-Type: ([^\r\n]+)/.exec(headerText)?.[1],
      body: rest.join("\r\n\r\n").replace(/\r\n$/, ""),
    });
  }
  return parts;
}

function part(name: string): Part | undefined {
  return requestParts().find((p) => p.name === name);
}

const bytes = (s: string) => new TextEncoder().encode(s);

beforeEach(() => {
  fetchMock.resetMocks();
  fetchMock.doMock();
});

describe("diarization", () => {
  it("should diarize audio alone, without a transcript part", async () => {
    mockResponse(segmentsOnly);
    const result = await assembly.diarization.diarize({
      audio: bytes("RIFFfake"),
    });

    expect(result).toEqual(segmentsOnly);
    expect(fetchMock.mock.calls[0][0]).toBe(defaultBaseUrl + diarizeUrl);
    expect(requestInit().method).toBe("POST");
    expect(requestHeaders()["Authorization"]).toBe(defaultApiKey);
    expect(requestHeaders()["Content-Type"]).toMatch(
      /^multipart\/form-data; boundary=/,
    );
    expect(requestParts().map((p) => p.name)).toEqual(["config", "audio"]);
    expect(JSON.parse(part("config")!.body)).toEqual({});
    expect(part("audio")).toMatchObject({
      filename: "audio.wav",
      type: "audio/wav",
      body: "RIFFfake",
    });
  });

  it("should send the transcript's words as a JSON part", async () => {
    mockResponse(labelled);
    const transcript = {
      words: [
        { text: "hi", start: 0, end: 300, confidence: 0.9 },
        { text: "hey", start: 4400, end: 4700 },
      ],
    };
    const result = await assembly.diarization.diarize({
      audio: bytes("RIFFfake"),
      transcript,
      config: { language_code: "es" },
    });

    expect(result.utterances[0].speaker).toBe("A");
    expect(requestParts().map((p) => p.name)).toEqual([
      "transcript",
      "config",
      "audio",
    ]);
    expect(part("transcript")!.type).toBe("application/json");
    expect(JSON.parse(part("transcript")!.body)).toEqual(transcript);
    expect(JSON.parse(part("config")!.body)).toEqual({ language_code: "es" });
  });

  it("should send an explicit empty words list", async () => {
    mockResponse(segmentsOnly);
    await assembly.diarization.diarize({
      audio: bytes("RIFF"),
      transcript: { words: [] },
    });
    expect(JSON.parse(part("transcript")!.body)).toEqual({ words: [] });
  });

  it("should take a sync transcription response as the transcript", async () => {
    mockResponse(labelled);
    const sync: SyncTranscriptResponse = {
      text: "hi hey",
      words: [
        { text: "hi", start: 0, end: 300, confidence: 0.9 },
        { text: "hey", start: 4400, end: 4700, confidence: 0.8 },
      ],
      confidence: 0.85,
      audio_duration_ms: 9500,
      session_id: "s",
      request_time_ms: 100,
    };
    await assembly.diarization.diarize({
      audio: bytes("RIFF"),
      transcript: sync,
    });
    expect(JSON.parse(part("transcript")!.body)).toEqual({
      words: sync.words,
    });
  });

  it("should send raw PCM as audio/pcm with its config", async () => {
    mockResponse(segmentsOnly);
    await assembly.diarization.diarize({
      audio: bytes("\x00\x01"),
      config: { sample_rate: 16000, channels: 1 },
    });
    expect(JSON.parse(part("config")!.body)).toEqual({
      sample_rate: 16000,
      channels: 1,
    });
    expect(part("audio")).toMatchObject({
      filename: "audio.pcm",
      type: "audio/pcm",
    });
  });

  it("should reject raw PCM missing a field before sending", async () => {
    await expect(
      assembly.diarization.diarize({
        audio: bytes("\x00"),
        config: { sample_rate: 16000 },
      }),
    ).rejects.toThrow("requires both sample_rate and channels");
    await expect(
      assembly.diarization.diarize({
        audio: bytes("\x00"),
        contentType: "audio/pcm",
      }),
    ).rejects.toThrow("requires both sample_rate and channels");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should infer the content type from the file extension, unless overridden", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "aai-diarization-"));
    try {
      const file = path.join(dir, "call.mp3");
      writeFileSync(file, "ID3fake");

      mockResponse(segmentsOnly);
      await assembly.diarization.diarize({ audio: file });
      expect(part("audio")).toMatchObject({
        filename: "call.mp3",
        type: "audio/mpeg",
        body: "ID3fake",
      });

      fetchMock.resetMocks();
      mockResponse(segmentsOnly);
      await assembly.diarization.diarize({
        audio: file,
        contentType: "audio/flac",
      });
      expect(part("audio")!.type).toBe("audio/flac");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("should read a stream whole and name it from its path", async () => {
    mockResponse(segmentsOnly);
    const stream = Readable.from([bytes("Ogg"), bytes("S")]);
    (stream as unknown as { path: string }).path = "/tmp/x/note.webm";
    await assembly.diarization.diarize({ audio: stream });
    expect(part("audio")).toMatchObject({
      filename: "note.webm",
      type: "audio/webm",
      body: "OggS",
    });
  });

  it("should reject a URL", async () => {
    await expect(
      assembly.diarization.diarize({ audio: "https://example.com/a.wav" }),
    ).rejects.toThrow("does not accept URLs");
  });

  it("should map a 401 problem+json to a DiarizationError", async () => {
    mockResponse(
      { status: 401, title: "Unauthorized", detail: "Missing API key" },
      401,
      { "Content-Type": "application/problem+json" },
    );
    const error = await assembly.diarization
      .diarize({ audio: bytes("RIFF") })
      .catch((e) => e);
    expect(error).toBeInstanceOf(DiarizationError);
    expect(error.name).toBe("DiarizationError");
    expect(error.status).toBe(401);
    expect(error.errorCode).toBe("unauthorized");
    expect(error.message).toBe("Missing API key");
  });

  it("should map a 400 validation error", async () => {
    mockResponse(
      {
        status: 400,
        title: "Bad Request",
        detail: "transcript: words: Field required",
      },
      400,
    );
    const error = await assembly.diarization
      .diarize({ audio: bytes("RIFF"), transcript: {} as never })
      .catch((e) => e);
    expect(error).toBeInstanceOf(DiarizationError);
    expect(error.status).toBe(400);
    expect(error.errorCode).toBe("bad_request");
    expect(error.message).toBe("transcript: words: Field required");
  });

  it("should carry Retry-After on a 503", async () => {
    mockResponse(
      { status: 503, title: "Service Unavailable", detail: "busy" },
      503,
      { "Retry-After": "3" },
    );
    const error = await assembly.diarization
      .diarize({ audio: bytes("RIFF") })
      .catch((e) => e);
    expect(error.status).toBe(503);
    expect(error.retryAfter).toBe(3);
  });

  it("should post to a custom diarizationBaseUrl", async () => {
    const eu = new AssemblyAI({
      apiKey: defaultApiKey,
      diarizationBaseUrl: "https://diarization.eu.assemblyai.com/",
    });
    fetchMock.mockResponseOnce(JSON.stringify(segmentsOnly));
    await eu.diarization.diarize({ audio: bytes("RIFF") });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://diarization.eu.assemblyai.com/v1/diarize",
    );
  });

  it("should default to the global host", async () => {
    const client = new AssemblyAI({ apiKey: defaultApiKey });
    fetchMock.mockResponseOnce(JSON.stringify(segmentsOnly));
    await client.diarization.diarize({ audio: bytes("RIFF") });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://diarization.assemblyai.com/v1/diarize",
    );
  });
});
