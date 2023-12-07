import { createReadStream } from "fs";
import "dotenv/config";
import {
  AssemblyAI,
  Transcript,
  FinalTranscript,
  LemurBaseResponse,
  PartialTranscript,
  RealtimeTranscript,
  CreateRealtimeServiceParams,
  TranscribeParams,
} from "../src";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY || "",
});

(async function transcribeUsingRealtime() {
  const useToken = false;
  let token: undefined | string = undefined;
  if (useToken) {
    token = await client.realtime.createTemporaryToken({
      expires_in: 480,
    });
  }
  const serviceParams: CreateRealtimeServiceParams = {
    sampleRate: 16_000,
    wordBoost: ["gore", "climate"],
    token: token,
  };
  const rt = client.realtime.createService(serviceParams);

  rt.on("open", ({ sessionId, expiresAt }) => {
    console.log("Session ID:", sessionId, "Expires At:", expiresAt);
  });
  rt.on("close", (code: number, reason: string) =>
    console.log("Closed", code, reason)
  );
  rt.on("transcript", (transcript: RealtimeTranscript) =>
    console.log("Transcript:", transcript)
  );
  rt.on("transcript.partial", (transcript: PartialTranscript) =>
    console.log("Transcript:", transcript)
  );
  rt.on("transcript.final", (transcript: FinalTranscript) =>
    console.log("Transcript:", transcript)
  );
  rt.on("error", (error: Error) => console.error("Error", error));

  try {
    await rt.connect();

    const chunkSize = 8 * 1024;
    const audio = createReadStream("./tests/static/gore-short.wav", {
      highWaterMark: chunkSize,
    });
    for await (const chunk of audio) {
      if (chunk.length < chunkSize) continue;
      rt.sendAudio(chunk);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    console.log("File end");

    await rt.close();
  } catch (error) {
    console.error(error);
  }
})();

const audioUrl = "https://storage.googleapis.com/aai-docs-samples/espn.m4a";
const transcribeParams: TranscribeParams = {
  audio: audioUrl,
  boost_param: "high",
  word_boost: ["Chicago", "draft"],
  disfluencies: true,
  dual_channel: true,
  format_text: false,
  language_code: "en",
  punctuate: false,
  speech_threshold: 0.5,
};

(async function uploadFileFromPath() {
  const uploadUrl = await client.files.upload("./tests/static/gore.wav");
  console.log("Upload URL:", uploadUrl);
})();

(async function transcribeFromPath() {
  const transcript = await client.transcripts.transcribe({
    audio: "./tests/static/gore.wav",
  });
  console.log(transcript);
  return transcript;
})().then((transcript) => deleteTranscript(transcript));

(async function transcribeFromStream() {
  const transcript = await client.transcripts.transcribe({
    audio: createReadStream("./tests/static/gore.wav"),
  });
  console.log(transcript);
  return transcript;
})().then((transcript) => deleteTranscript(transcript));

(async function createStandardTranscript() {
  const transcript = await client.transcripts.transcribe(transcribeParams);
  console.log(transcript);
  return transcript;
})().then(async (transcript) => {
  await exportAsSubtitles(transcript);
  await getParagraphs(transcript);
  await getSentences(transcript);
  await searchTranscript(transcript);
  await deleteTranscript(transcript);
});

(async function runLemurModels() {
  const transcript = await client.transcripts.transcribe(transcribeParams);
  await lemurSummary(transcript).then(purgeLemurRequestData);
  await lemurQuestionAnswer(transcript).then(purgeLemurRequestData);
  await lemurActionPoints(transcript).then(purgeLemurRequestData);
  await lemurCustomTask(transcript).then(purgeLemurRequestData);
  await deleteTranscript(transcript);
})();

(async function createTranscriptWithBadUrl() {
  const transcript = await client.transcripts.transcribe({
    audio: "https://storage.googleapis.com/api-docs-samples/oops.m4a",
  });
  console.log(transcript);
  return transcript;
})().then(async (transcript) => {
  try {
    await getParagraphs(transcript);
    console.error("Error expected but not thrown.");
  } catch (error) {
    console.log("Error expected:", error);
    await deleteTranscript(transcript);
  }
});

(async function createTranscriptWithNullUrl() {
  try {
    await client.transcripts.create({
      audio_url: null as unknown as string,
    });
    console.error("Error expected but not thrown.");
  } catch (error) {
    console.log("Error expected:", error);
  }
})();

(async function createTranscriptWithword_boost() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    boost_param: "high",
    word_boost: ["knee", "hip"],
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithSummarization() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    summarization: true,
    summary_model: "conversational",
    summary_type: "bullets_verbose",
    punctuate: true,
    format_text: true,
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithContentSafety() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    content_safety: true,
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithCustomSpelling() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    custom_spelling: [
      { from: ["quarterback", "QB"], to: "nickelback" },
      { from: ["bear"], to: "cub" },
    ],
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithEntityDetection() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    entity_detection: true,
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithFilterProfanity() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    filter_profanity: true,
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithTopicDetection() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    iab_categories: true,
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithLanguageDetection() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    language_code: undefined,
    language_detection: true,
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithPiiRedaction() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    format_text: true,
    redact_pii: true,
    redact_pii_audio: true,
    redact_pii_audio_quality: "wav",
    redact_pii_policies: ["injury", "medical_condition", "medical_process"],
    redact_pii_sub: "hash",
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithSentimentAnalysis() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    punctuate: true,
    sentiment_analysis: true,
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithSpeakerLabels() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    dual_channel: false,
    punctuate: true,
    speaker_labels: true,
    speakers_expected: 2,
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithWebhook() {
  const transcript = await client.transcripts.transcribe({
    ...transcribeParams,
    webhook_auth_header_name: "x-foo",
    webhook_auth_header_value: "bar",
    webhook_url: "https://www.assemblyai.com/404",
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function listTranscripts() {
  let nextPageUrl: string | undefined | null;
  do {
    const page = await client.transcripts.list(
      nextPageUrl as string | undefined
    );
    console.log(page);
    nextPageUrl = page.page_details.next_url;
  } while (nextPageUrl);
})();

async function searchTranscript(transcript: Transcript) {
  const result = await client.transcripts.wordSearch(transcript.id, [
    "draft",
    "football",
  ]);
  console.log(result);
}

async function exportAsSubtitles(transcript: Transcript) {
  const srt = await client.transcripts.subtitles(transcript.id, "srt");
  const vtt = await client.transcripts.subtitles(transcript.id, "vtt");
  console.log("SRT subtitles", srt);
  console.log("VTT subtitles", vtt);
}

async function getParagraphs(transcript: Transcript) {
  const paragraphs = await client.transcripts.paragraphs(transcript.id);
  console.dir(paragraphs, { depth: null });
}

async function getSentences(transcript: Transcript) {
  const sentences = await client.transcripts.sentences(transcript.id);
  console.dir(sentences, { depth: null });
}

async function deleteTranscript(transcript: Transcript) {
  await client.transcripts.delete(transcript.id);
}

const lemurContext =
  "This is a podcast on the ESPN channel talking about NFL draft picks.";

async function lemurSummary(transcript: Transcript) {
  const response = await client.lemur.summary({
    transcript_ids: [transcript.id],
    context: lemurContext,
    final_model: "basic",
    max_output_size: 3000,
    answer_format: "bullet points",
  });
  console.log(response.response);
  return response;
}

async function lemurQuestionAnswer(transcript: Transcript) {
  const response = await client.lemur.questionAnswer({
    transcript_ids: [transcript.id],
    questions: [
      {
        question: "Which players were mentioned?",
        context: lemurContext,
        answer_format: "<name> <jersey_number>",
      },
      {
        question: "Were they excited",
        context: lemurContext,
        answer_options: ["yes", "no"],
      },
    ],
    context: lemurContext,
    final_model: "basic",
    max_output_size: 3000,
  });
  console.log(response.response);
  return response;
}

async function lemurActionPoints(transcript: Transcript) {
  const response = await client.lemur.actionItems({
    transcript_ids: [transcript.id],
    context: lemurContext,
    final_model: "basic",
    max_output_size: 3000,
  });
  console.log(response.response);
  return response;
}

async function lemurCustomTask(transcript: Transcript) {
  const response = await client.lemur.task({
    transcript_ids: [transcript.id],
    prompt: "List all the teams and their players that are mentioned.",
    context: lemurContext,
    final_model: "basic",
    max_output_size: 3000,
  });
  console.log(response.response);
  return response;
}

async function purgeLemurRequestData(lemurResponse: LemurBaseResponse) {
  const response = await client.lemur.purgeRequestData(
    lemurResponse.request_id
  );
  console.log(response);
}
