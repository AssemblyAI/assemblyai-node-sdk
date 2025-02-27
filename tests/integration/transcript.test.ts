import path from "path";
import "dotenv/config";
import { AssemblyAI } from "../../src";
import { readFile } from "fs/promises";

const testDir = process.env["TESTDATA_DIR"] ?? "tests/static";
const remoteAudioUrl = "https://assembly.ai/espn.m4a";
const badRemoteAudioURL =
  "https://storage.googleapis.com/aai-web-samples/does-not-exist.m4a";
const knownTranscriptId = process.env.TEST_TRANSCRIPT_ID!;

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

describe("transcript", () => {
  it("submit create the transcript object with a remote url", async () => {
    const transcript = await client.transcripts.submit({
      audio: remoteAudioUrl,
    });

    expect(transcript.status).toBeTruthy();
    expect(transcript.status).not.toBe("error");
    expect(transcript.status).not.toBe("complete");
  });

  it("submit should create the transcript object with a local file", async () => {
    const transcript = await client.transcripts.submit({
      audio: path.join(testDir, "gore.wav"),
    });

    expect(["processing", "queued"]).toContain(transcript.status);
  });

  it("submit should create the transcript object from data URI", async () => {
    const dataUri = `data:audio/wav;base64,${await readFile(
      path.join(testDir, "gore.wav"),
      "base64",
    )}`;
    const transcript = await client.transcripts.submit({
      audio: dataUri,
    });

    expect(["processing", "queued"]).toContain(transcript.status);
  });

  it("should get the transcript object", async () => {
    const transcript = await client.transcripts.get(knownTranscriptId);

    expect(transcript.id).toBeTruthy();
    expect(transcript.text).toBeTruthy();
  });

  it("transcribe should poll the transcript object", async () => {
    const transcript = await client.transcripts.transcribe({
      audio: remoteAudioUrl,
    });

    expect(transcript.status).toBe("completed");
  });

  it("should transcribe multichannel audio", async () => {
    const transcript = await client.transcripts.transcribe({
      audio:
        "https://assemblyai-test.s3.us-west-2.amazonaws.com/e2e_tests/en_7dot1_audio_channels.wav",
      multichannel: true,
    });

    const expectedOutput = [
      "One.",
      "Two.",
      "Three.",
      "Four.",
      "Five.",
      "Six.",
      "Seven.",
      "Eight.",
    ];
    expect(transcript.multichannel).toBe(true);
    expect(transcript.words!.length).toBe(expectedOutput.length);
    expect(transcript.utterances!.length).toBe(expectedOutput.length);
    const words = transcript.words!;
    const utterances = transcript.utterances!;
    for (let i = 0; i < expectedOutput.length; i++) {
      const channelString = String(i + 1);
      const expectedWord = expectedOutput[i];
      expect(words[i].text).toBe(expectedWord);
      expect(words[i].speaker).toBe(channelString);
      expect(words[i].channel).toBe(channelString);
      expect(utterances[i].text).toBe(expectedWord);
      expect(utterances[i].speaker).toBe(channelString);
      expect(utterances[i].channel).toBe(channelString);
      expect(utterances[i].words.length).toBe(1);
      expect(utterances[i].words[0].text).toBe(expectedWord);
      expect(utterances[i].words[0].speaker).toBe(channelString);
      expect(utterances[i].words[0].channel).toBe(channelString);
    }
  }, 20_000);

  it("should wait on the transcript until ready", async () => {
    let transcript = await client.transcripts.submit({
      audio: remoteAudioUrl,
    });
    transcript = await client.transcripts.waitUntilReady(transcript.id);

    expect(transcript.status).toBe("completed");
  });

  it("should retrieve a page of transcripts", async () => {
    const page = await client.transcripts.list();
    expect(Array.isArray(page.transcripts)).toBeTruthy();
    expect(page.page_details).not.toBeNull();
  });

  it("should delete the transcript object", async () => {
    let transcript = await client.transcripts.transcribe({
      audio: remoteAudioUrl,
    });
    transcript = await client.transcripts.delete(transcript.id);
    expect(transcript.audio_url).toBe("http://deleted_by_user");
  });

  it("transcribe should fail to create the transcript object", async () => {
    const transcript = await client.transcripts.transcribe({
      audio: badRemoteAudioURL,
    });
    expect(transcript.status).toBe("error");
    expect(transcript.error).toBeTruthy();
  });

  it("should get paragraphs", async () => {
    const paragraphsResponse =
      await client.transcripts.paragraphs(knownTranscriptId);
    expect(Array.isArray(paragraphsResponse.paragraphs)).toBeTruthy();
    expect(paragraphsResponse.paragraphs.length).toBeGreaterThan(0);
  });

  it("should get sentences", async () => {
    const sentencesResponse =
      await client.transcripts.sentences(knownTranscriptId);
    expect(Array.isArray(sentencesResponse.sentences)).toBeTruthy();
    expect(sentencesResponse.sentences.length).toBeGreaterThan(0);
  });

  it("should get srt subtitles", async () => {
    const subtitle = await client.transcripts.subtitles(
      knownTranscriptId,
      "srt",
      32,
    );
    expect(subtitle).toBeTruthy();
  });

  it("should get vtt subtitles", async () => {
    const subtitle = await client.transcripts.subtitles(
      knownTranscriptId,
      "vtt",
      32,
    );
    expect(subtitle).toBeTruthy();
  });

  it("should get redacted audio", async () => {
    const transcript = await client.transcripts.transcribe({
      audio: remoteAudioUrl,
      redact_pii: true,
      redact_pii_audio: true,
      redact_pii_audio_quality: "wav",
      redact_pii_policies: ["medical_condition"],
      redact_pii_sub: "hash",
    });
    const redactedAudioResponse = await client.transcripts.redactedAudio(
      transcript.id,
    );
    expect(redactedAudioResponse.status).toBe("redacted_audio_ready");
    expect(redactedAudioResponse.redacted_audio_url).toBeTruthy();
  }, 30_000);

  it("should get redacted audio file", async () => {
    const transcript = await client.transcripts.transcribe({
      audio: remoteAudioUrl,
      redact_pii: true,
      redact_pii_audio: true,
      redact_pii_audio_quality: "wav",
      redact_pii_policies: ["medical_condition"],
      redact_pii_sub: "hash",
    });
    const redactedAudioResponse = await client.transcripts.redactedAudioFile(
      transcript.id,
    );
    expect((await redactedAudioResponse.blob()).size).toBeGreaterThan(0);
  }, 60_000);

  it("should word search", async () => {
    const searchResponse = await client.transcripts.wordSearch(
      knownTranscriptId,
      ["Giants"],
    );
    expect(searchResponse.id).toBe(knownTranscriptId);
    expect(searchResponse.total_count).toBeGreaterThan(0);
    expect(Array.isArray(searchResponse.matches)).toBeTruthy();
    expect(searchResponse.matches.length).toBeGreaterThan(0);
  });
});
