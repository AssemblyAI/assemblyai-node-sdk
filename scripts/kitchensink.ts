import { createReadStream } from 'fs'
import 'dotenv/config'
import AssemblyAI, { Transcript, CreateTranscriptParameters } from '../src/index';
import { FinalTranscript, PartialTranscript, RealtimeTranscript } from '../src/types'

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY || '',
});

(async function transcribeUsingRealtime() {
  const useToken = false;
  const serviceParams: any = {
    sample_rate: 16_000,
    word_boost: ['gore', 'climate']
  };
  if (useToken) {
    serviceParams.token = await client.realtime.createTemporaryToken({ expires_in: 480 });
  }
  const rt = client.realtime.createService(serviceParams);

  rt.on("open", ({ sessionId, expiresAt }) => {
    console.log('Session ID:', sessionId, 'Expires At:', expiresAt);
  });
  rt.on("close", (code: number, reason: string) => console.log('Closed', code, reason))
  rt.on("transcript", (transcript: RealtimeTranscript) => console.log('Transcript:', transcript));
  rt.on("transcript.partial", (transcript: PartialTranscript) => console.log('Transcript:', transcript));
  rt.on("transcript.final", (transcript: FinalTranscript) => console.log('Transcript:', transcript));
  rt.on("error", (error: Error) => console.error('Error', error));


  try {
    await rt.connect();

    const chunkSize = 8 * 1024;
    const audio = createReadStream(
      './tests/static/gore-short.wav',
      { highWaterMark: chunkSize }
    );
    for await (const chunk of audio) {
      if (chunk.length < chunkSize) continue;
      rt.sendAudio(chunk);
      await new Promise((resolve) =>
        setTimeout(resolve, 300)
      );
    }
    console.log('File end')

    await rt.close();
  } catch (error) {
    console.error(error);
  }
})();

const audioUrl = 'https://storage.googleapis.com/aai-docs-samples/espn.m4a';
const createTranscriptParams: CreateTranscriptParameters  = {
  audio_url: audioUrl,
  boost_param: 'high',
  word_boost: ['Chicago', 'draft'],
  disfluencies: true,
  dual_channel: true,
  format_text: false,
  language_code: 'en',
  punctuate: false,
  speech_threshold: 0.5,
};

(async function createStandardTranscript() {
  const transcript = await client.transcripts.create(createTranscriptParams);
  console.log(transcript);
  return transcript;
})()
  .then(async (transcript) => {
    await exportAsSubtitles(transcript);
    await getParagraphs(transcript);
    await getSentences(transcript);
    await searchTranscript(transcript);
    await deleteTranscript(transcript);
  });

(async function runLemurModels() {
  const transcript = await client.transcripts.create(createTranscriptParams);
  await lemurSummary(transcript);
  await lemurQuestionAnswer(transcript);
  await lemurActionPoints(transcript);
  await lemurCustomTask(transcript);
  await deleteTranscript(transcript);
})();

(async function createTranscriptWithBadUrl() {
  const transcript = await client.transcripts.create({
    audio_url: 'https://storage.googleapis.com/api-docs-samples/oops.m4a'
  });
  console.log(transcript);
  return transcript;
})().then(async (transcript) => {
  try {
    await getParagraphs(transcript);
    console.error("Error expected but not thrown.");
  } catch (error) {
    console.log("Error expected:", error.toString());
    await deleteTranscript(transcript);
  }
});

(async function createTranscriptWithNullUrl() {
  try {
    await client.transcripts.create({
      audio_url: null as unknown as string
    });
    console.error("Error expected but not thrown.");
  } catch (error) {
    console.log("Error expected:", error.toString());
  }
})();

(async function createTranscriptWithword_boost() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    boost_param: 'high',
    word_boost: ['knee', 'hip'],
  });
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithSummarization() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    summarization: true,
    summary_model: 'conversational',
    summary_type: 'bullets_verbose',
    punctuate: true,
    format_text: true
  })
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithContentSafety() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    content_safety: true,
  })
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithCustomSpelling() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    custom_spelling: [
      { from: ['quarterback', 'QB'], to: 'nickelback' },
      { from: ['bear'], to: 'cub' },
    ]
  })
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithEntityDetection() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    entity_detection: true,
  })
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithFilterProfanity() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    filter_profanity: true,
  })
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithTopicDetection() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    iab_categories: true
  })
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithLanguageDetection() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    language_code: undefined,
    language_detection: true
  })
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithPiiRedaction() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    format_text: true,
    redact_pii: true,
    redact_pii_audio: true,
    redact_pii_audio_quality: 'wav',
    redact_pii_policies: [
      'injury',
      'medical_condition',
      'medical_process'
    ],
    redact_pii_sub: 'hash',
  })
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithSentimentAnalysis() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    punctuate: true,
    sentiment_analysis: true,
  })
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithSpeakerLabels() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    dual_channel: false,
    punctuate: true,
    speaker_labels: true,
    speakers_expected: 2,
  })
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function createTranscriptWithWebhook() {
  const transcript = await client.transcripts.create({
    ...createTranscriptParams,
    webhook_auth_header_name: 'x-foo',
    webhook_auth_header_value: 'bar',
    webhook_url: 'https://www.assemblyai.com/404'
  })
  console.log(transcript);
  return transcript;
})().then(deleteTranscript);

(async function listTranscripts() {
  let nextPageUrl: string | null = null;
  do {
    const page = await client.transcripts.list(nextPageUrl)
    console.log(page);
    nextPageUrl = page.page_details.next_url;
  } while (nextPageUrl !== null)
})();

async function searchTranscript(transcript: Transcript) {
  console.error('Search is not yet implemented');
  // const result = await client.transcripts.search(transcript.id, {
  //   words: ['draft', 'football']
  // });
  // console.log(result);
}

async function exportAsSubtitles(transcript: Transcript) {
  const srt = await client.transcripts.subtitles(transcript.id, 'srt')
  const vtt = await client.transcripts.subtitles(transcript.id, 'vtt')
  console.log('SRT subtitles', srt);
  console.log('VTT subtitles', vtt);
}

async function getParagraphs(transcript: Transcript) {
  const paragraphs = await client.transcripts.paragraphs(transcript.id)
  console.dir(paragraphs, { depth: null });
}

async function getSentences(transcript: Transcript) {
  const sentences = await client.transcripts.sentences(transcript.id)
  console.dir(sentences, { depth: null });
}

async function deleteTranscript(transcript: Transcript) {
  await client.transcripts.delete(transcript.id);
}

const lemurContext = 'This is a podcast on the ESPN channel talking about NFL draft picks.';

async function lemurSummary(transcript: Transcript) {
  const response = await client.lemur.summary({
    transcript_ids: [transcript.id],
    context: lemurContext,
    final_model: 'basic',
    max_output_size: 3000,
    answer_format: 'bullet points'
  })
  console.log(response.response);
}

async function lemurQuestionAnswer(transcript: Transcript) {
  const response = await client.lemur.questionAnswer({
    transcript_ids: [transcript.id],
    questions: [
      {
        question: 'Which players were mentioned?',
        context: lemurContext,
        answer_format: '<name> <jersey_number>',
      },
      {
        question: 'Were they excited',
        context: lemurContext,
        answer_options: ['yes', 'no']
      }
    ],
    context: lemurContext,
    final_model: 'basic',
    max_output_size: 3000
  })
  console.log(response.response);
}

async function lemurActionPoints(transcript: Transcript) {
  const response = await client.lemur.actionItems({
    transcript_ids: [transcript.id],
    context: lemurContext,
    final_model: 'basic',
    max_output_size: 3000
  })
  console.log(response.response);
}

async function lemurCustomTask(transcript: Transcript) {
  const response = await client.lemur.task({
    transcript_ids: [transcript.id],
    prompt: 'List all the teams and their players that are mentioned.',
    context: lemurContext,
    final_model: 'basic',
    max_output_size: 3000
  })
  console.log(response.response);
}
