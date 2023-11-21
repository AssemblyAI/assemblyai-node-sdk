import { AssemblyAI } from "../src";
import fetchMock from "jest-fetch-mock";
import path from "path";
import {
  createClient,
  defaultApiKey,
  defaultBaseUrl,
  requestMatches,
} from "./utils";

fetchMock.enableMocks();

const testDir = process.env["TESTDATA_DIR"] ?? ".";

const assembly = createClient();

const knownTranscriptIds = ["transcript_123"];
const transcriptId = knownTranscriptIds[0];
const remoteAudioURL =
  "https://storage.googleapis.com/aai-web-samples/espn-bears.m4a";
const badRemoteAudioURL =
  "https://storage.googleapis.com/aai-web-samples/does-not-exist.m4a";

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.resetMocks();
  fetchMock.doMock();
});

describe("transcript", () => {
  it("create should create the transcript object with a remote url", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" })
    );
    const transcript = await assembly.transcripts.create(
      {
        audio_url: remoteAudioURL,
      },
      {
        poll: false,
      }
    );

    expect(transcript.status).toBeTruthy();
    expect(transcript.status).not.toBe("error");
    expect(transcript.status).not.toBe("complete");
  });

  it("submit create the transcript object with a remote url", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" })
    );
    const transcript = await assembly.transcripts.submit({
      audio: remoteAudioURL,
    });

    expect(transcript.status).toBeTruthy();
    expect(transcript.status).not.toBe("error");
    expect(transcript.status).not.toBe("complete");
  });

  it("create should create the transcript object with a local file", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/upload", method: "POST" }),
      JSON.stringify({ upload_url: "https://example.com" })
    );
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" })
    );
    const transcript = await assembly.transcripts.create(
      {
        audio_url: path.join(testDir, "gore.wav"),
      },
      {
        poll: false,
      }
    );

    expect(["processing", "queued"]).toContain(transcript.status);
  });

  it("submit should create the transcript object with a local file", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/upload", method: "POST" }),
      JSON.stringify({ upload_url: "https://example.com" })
    );
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ id: transcriptId, status: "queued" })
    );
    const transcript = await assembly.transcripts.submit({
      audio: path.join(testDir, "gore.wav"),
    });

    expect(["processing", "queued"]).toContain(transcript.status);
  });

  it("should get the transcript object", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: `/v2/transcript/${transcriptId}`, method: "GET" }),
      JSON.stringify({ id: transcriptId })
    );
    const fetched = await assembly.transcripts.get(transcriptId);

    expect(fetched.id).toBeTruthy();
  });

  it("transcribe should poll the transcript object", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ status: "queued", id: transcriptId })
    );
    fetchMock.doMockOnceIf(
      requestMatches({ url: `/v2/transcript/${transcriptId}`, method: "GET" }),
      JSON.stringify({ status: "processing" })
    );
    fetchMock.doMockOnceIf(
      requestMatches({ url: `/v2/transcript/${transcriptId}`, method: "GET" }),
      JSON.stringify({ status: "completed" })
    );
    const transcript = await assembly.transcripts.transcribe(
      {
        audio: remoteAudioURL,
      },
      {
        pollingInterval: 1000,
        pollingTimeout: 5000,
      }
    );

    expect(transcript.status).toBe("completed");
  }, 6000);

  it("create should poll the transcript object", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "POST" }),
      JSON.stringify({ status: "queued", id: transcriptId })
    );
    fetchMock.doMockOnceIf(
      requestMatches({ url: `/v2/transcript/${transcriptId}`, method: "GET" }),
      JSON.stringify({ status: "processing" })
    );
    fetchMock.doMockOnceIf(
      requestMatches({ url: `/v2/transcript/${transcriptId}`, method: "GET" }),
      JSON.stringify({ status: "completed" })
    );
    const transcript = await assembly.transcripts.create(
      {
        audio_url: remoteAudioURL,
      },
      {
        pollingInterval: 1000,
        pollingTimeout: 5000,
      }
    );

    expect(transcript.status).toBe("completed");
  }, 6000);

  it("should wait on the transcript until ready", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: `/v2/transcript/${transcriptId}`, method: "GET" }),
      JSON.stringify({ status: "queued", id: transcriptId })
    );
    fetchMock.doMockOnceIf(
      requestMatches({ url: `/v2/transcript/${transcriptId}`, method: "GET" }),
      JSON.stringify({ status: "processing" })
    );
    fetchMock.doMockOnceIf(
      requestMatches({ url: `/v2/transcript/${transcriptId}`, method: "GET" }),
      JSON.stringify({ status: "completed" })
    );
    const transcript = await assembly.transcripts.waitUntilReady(transcriptId, {
      pollingInterval: 1000,
      pollingTimeout: 5000,
    });

    expect(transcript.status).toBe("completed");
  }, 6000);

  it("should retrieve a page of transcripts", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({ url: "/v2/transcript", method: "GET" }),
      JSON.stringify({
        transcripts: [],
        page_details: {
          limit: 20,
          result_count: 10,
          next_url: `https://api.assemblyai.com/v2/transcript?after_id=${knownTranscriptIds[0]}`,
          previous_url: "https://api.assemblyai.com/v2/transcript",
        },
      })
    );
    const page = await assembly.transcripts.list();
    expect(page.transcripts).toBeInstanceOf(Array);
    expect(page.page_details).not.toBeNull();
  });

  it("should delete the transcript object", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({
        url: `/v2/transcript/${transcriptId}`,
        method: "DELETE",
      }),
      JSON.stringify({ id: transcriptId })
    );
    const deleted = await assembly.transcripts.delete(transcriptId);

    expect(fetch).toHaveBeenLastCalledWith(
      `${defaultBaseUrl}/v2/transcript/${transcriptId}`,
      {
        headers: {
          Authorization: defaultApiKey,
          "Content-Type": "application/json",
        },
        method: "DELETE",
      }
    );
    expect(deleted.id).toBe(transcriptId);
  });

  it("submit should fail to create the transcript object", async () => {
    const errorResponse = { status: "error" };
    fetchMock.mockResponseOnce(JSON.stringify(errorResponse));
    const created = await assembly.transcripts.submit({
      audio: badRemoteAudioURL,
    });

    expect(created).toStrictEqual(errorResponse);
    expect(fetch).toHaveBeenLastCalledWith(`${defaultBaseUrl}/v2/transcript`, {
      body: JSON.stringify({ audio_url: badRemoteAudioURL }),
      headers: {
        Authorization: defaultApiKey,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("create should fail to create the transcript object", async () => {
    const errorResponse = { status: "error" };
    fetchMock.mockResponseOnce(JSON.stringify(errorResponse));
    const created = await assembly.transcripts.create(
      {
        audio_url: badRemoteAudioURL,
      },
      {
        poll: false,
      }
    );

    expect(created).toStrictEqual(errorResponse);
    expect(fetch).toHaveBeenLastCalledWith(`${defaultBaseUrl}/v2/transcript`, {
      body: JSON.stringify({ audio_url: badRemoteAudioURL }),
      headers: {
        Authorization: defaultApiKey,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("transcribe should fail to poll", async () => {
    fetchMock.mockResponse(JSON.stringify({ status: "queued" }));
    const promise = assembly.transcripts.transcribe(
      {
        audio: badRemoteAudioURL,
      },
      {
        pollingInterval: 1_000,
        pollingTimeout: 1_000,
      }
    );

    await expect(promise).rejects.toThrow("Polling timeout");
    fetchMock.resetMocks();
  });

  it("create should fail to poll", async () => {
    fetchMock.mockResponse(JSON.stringify({ status: "queued" }));
    const promise = assembly.transcripts.create(
      {
        audio_url: badRemoteAudioURL,
      },
      {
        pollingInterval: 1_000,
        pollingTimeout: 1_000,
      }
    );

    await expect(promise).rejects.toThrow("Polling timeout");
    fetchMock.resetMocks();
  });

  it("should get paragraphs", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({
        url: `/v2/transcript/${transcriptId}/paragraphs`,
        method: "GET",
      }),
      JSON.stringify({ transcriptId, paragraphs: ["paragraph 1"] })
    );
    const segment = await assembly.transcripts.paragraphs(transcriptId);

    expect(segment.paragraphs).toBeInstanceOf(Array);
    expect(segment.paragraphs.length).toBeGreaterThan(0);
  });

  it("should get sentences", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({
        url: `/v2/transcript/${transcriptId}/sentences`,
        method: "GET",
      }),
      JSON.stringify({ transcriptId, sentences: ["sentence 1"] })
    );
    const segment = await assembly.transcripts.sentences(transcriptId);

    expect(segment.sentences).toBeInstanceOf(Array);
    expect(segment.sentences.length).toBeGreaterThan(0);
  });

  it("should get srt subtitles", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({
        url: `/v2/transcript/${transcriptId}/srt?chars_per_caption=32`,
        method: "GET",
      }),
      "Lorem ipsum"
    );
    const subtitle = await assembly.transcripts.subtitles(
      transcriptId,
      "srt",
      32
    );

    expect(subtitle).toBeTruthy();
  });

  it("should get vtt subtitles", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({
        url: `/v2/transcript/${transcriptId}/vtt?chars_per_caption=32`,
        method: "GET",
      }),
      "Lorem ipsum"
    );
    const subtitle = await assembly.transcripts.subtitles(
      transcriptId,
      "vtt",
      32
    );

    expect(subtitle).toBeTruthy();
  });

  it("should get redactions", async () => {
    fetchMock.doMockOnceIf(
      requestMatches({
        url: `/v2/transcript/${transcriptId}/redacted-audio`,
        method: "GET",
      }),
      JSON.stringify({
        status: "redacted_audio_ready",
        redacted_audio_url: "https://some-url.com",
      })
    );
    const res = await assembly.transcripts.redactions(transcriptId);
    expect(res.status).toBe("redacted_audio_ready");
    expect(res.redacted_audio_url).toBeTruthy();
  });

  it("should word search", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        id: transcriptId,
        total_count: 1,
        matches: [{}],
      })
    );
    const res = await assembly.transcripts.wordSearch(transcriptId, ["bears"]);

    expect(res.id).toBe(transcriptId);
    expect(res.total_count).toBe(1);
    expect(res.matches).toBeInstanceOf(Array);
  });
});
