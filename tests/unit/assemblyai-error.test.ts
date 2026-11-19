import fetchMock from "jest-fetch-mock";
import {
  AssemblyAIError,
  SyncTranscriptError,
  DictationError,
  LlmGatewayError,
  TextToSpeechError,
} from "../../src";
import { createClient } from "./utils";

fetchMock.enableMocks();

describe("AssemblyAIError and BaseService error handling", () => {
  const client = createClient();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.resetMocks();
    fetchMock.doMock();
  });

  it("throws AssemblyAIError on JSON error body with status and error message", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({ error: "audio_url is required" }),
      { status: 400, statusText: "Bad Request" },
    );

    let caught: unknown;
    try {
      await client.transcripts.submit({
        audio: "https://example.com/audio.mp3",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(AssemblyAIError);
    const error = caught as AssemblyAIError;
    expect(error.name).toBe("AssemblyAIError");
    expect(error.message).toBe("audio_url is required");
    expect(error.status).toBe(400);
    expect(error.retryAfter).toBeUndefined();
  });

  it("throws AssemblyAIError on plain text error body", async () => {
    fetchMock.mockResponseOnce("Service Unavailable", {
      status: 503,
      statusText: "Service Unavailable",
    });

    let caught: unknown;
    try {
      await client.transcripts.get("tx-123");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AssemblyAIError);
    const error = caught as AssemblyAIError;
    expect(error.message).toBe("Service Unavailable");
    expect(error.status).toBe(503);
    expect(error.retryAfter).toBeUndefined();
  });

  it("throws AssemblyAIError on empty error body with status and statusText", async () => {
    fetchMock.mockResponseOnce("", {
      status: 404,
      statusText: "Not Found",
    });

    let caught: unknown;
    try {
      await client.transcripts.get("tx-nonexistent");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AssemblyAIError);
    const error = caught as AssemblyAIError;
    expect(error.message).toBe("HTTP Error: 404 Not Found");
    expect(error.status).toBe(404);
  });

  it("extracts numeric Retry-After header on 429 rate limit responses", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({ error: "Rate limit exceeded" }),
      {
        status: 429,
        statusText: "Too Many Requests",
        headers: { "Retry-After": "25" },
      },
    );

    let caught: unknown;
    try {
      await client.transcripts.submit({
        audio: "https://example.com/audio.mp3",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AssemblyAIError);
    const error = caught as AssemblyAIError;
    expect(error.message).toBe("Rate limit exceeded");
    expect(error.status).toBe(429);
    expect(error.retryAfter).toBe(25);
  });

  it("handles non-numeric or absent Retry-After header gracefully", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      statusText: "Too Many Requests",
      headers: { "Retry-After": "invalid-value" },
    });

    let caught: unknown;
    try {
      await client.transcripts.submit({
        audio: "https://example.com/audio.mp3",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AssemblyAIError);
    const error = caught as AssemblyAIError;
    expect(error.status).toBe(429);
    expect(error.retryAfter).toBeUndefined();
  });

  it("subclasses inherit from AssemblyAIError for unified error catching", () => {
    const syncErr = new SyncTranscriptError("sync error", 400, "bad_audio", 5);
    expect(syncErr).toBeInstanceOf(AssemblyAIError);
    expect(syncErr).toBeInstanceOf(SyncTranscriptError);
    expect(syncErr.status).toBe(400);
    expect(syncErr.errorCode).toBe("bad_audio");
    expect(syncErr.retryAfter).toBe(5);

    const dictErr = new DictationError(
      "dictation error",
      429,
      "rate_limited",
      10,
    );
    expect(dictErr).toBeInstanceOf(AssemblyAIError);
    expect(dictErr).toBeInstanceOf(DictationError);
    expect(dictErr.status).toBe(429);
    expect(dictErr.errorCode).toBe("rate_limited");
    expect(dictErr.retryAfter).toBe(10);

    const llmErr = new LlmGatewayError("llm error", 500, "req-1", ["err1"]);
    expect(llmErr).toBeInstanceOf(AssemblyAIError);
    expect(llmErr).toBeInstanceOf(LlmGatewayError);
    expect(llmErr.status).toBe(500);
    expect(llmErr.requestId).toBe("req-1");
    expect(llmErr.errors).toEqual(["err1"]);

    const ttsErr = new TextToSpeechError("tts error", {
      status: 503,
      retryAfter: 3,
      errorCode: "auth_unavailable",
    });
    expect(ttsErr).toBeInstanceOf(AssemblyAIError);
    expect(ttsErr).toBeInstanceOf(TextToSpeechError);
    expect(ttsErr.status).toBe(503);
    expect(ttsErr.retryAfter).toBe(3);
    expect(ttsErr.errorCode).toBe("auth_unavailable");
  });
});
