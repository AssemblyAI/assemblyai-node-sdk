/**
 * mock api with reproduction of the common behaviors/endpoints of the real api
 */

import type { LemurBaseParameters } from '../../src/'

export const knownTranscriptIds = ['123']
const lemurResponse = {
  response: 'some response',
  requestId: 'request_id',
}

const withTranscriptId = (
  input: LemurBaseParameters,
  output: unknown | (() => unknown),
) => {
  // omitting the nullish getter (?.) here causes a weird issue with jest
  // TODO: investigate why that happens```
  if (input.transcript_ids?.some((id: string) => !knownTranscriptIds.includes(id))) {
    throw 'each transcript source id must be valid'
  }

  return typeof output === 'function' ? output() : output
}

export const post = (input: unknown) => ({
  // lemur
  '/lemur/v3/generate/summary': withTranscriptId(
    input as LemurBaseParameters,
    lemurResponse,
  ),
  '/lemur/v3/generate/action-items': withTranscriptId(
    input as LemurBaseParameters,
    lemurResponse,
  ),
  '/lemur/v3/generate/task': withTranscriptId(
    input as LemurBaseParameters,
    lemurResponse,
  ),
  '/lemur/v3/generate/question-answer': withTranscriptId(
    input as LemurBaseParameters,
    {
      ...lemurResponse,
      response: [
        {
          question: 'question',
          answer: 'answer',
        },
      ],
    },
  ),

  // files
  '/v2/upload': { upload_url: 'https://some-url.com' },
  // transcript
  '/v2/transcript': { id: knownTranscriptIds[0], status: 'queued' },
  // realtime
  '/v2/realtime/token': { token: '123' }
})

export const get = () => ({
  // transcript
  '/v2/transcript': {
    transcripts: [],
    page_details: {
      limit: 20,
      result_count: 10,
      next_url: `https://api.assemblyai.com/v2/transcript?after_id=${knownTranscriptIds[0]}`,
      previous_url: 'https://api.assemblyai.com/v2/transcript',
    }
  },
  ...Object.fromEntries(
    knownTranscriptIds.map((id) => [[`/v2/transcript/${id}`], { id }]),
  ),
  // transcript segments
  ...Object.fromEntries(
    knownTranscriptIds.map((id) => [
      [`/v2/transcript/${id}/paragraphs`],
      { id, paragraphs: ['paragraph 1'] },
    ]),
  ),
  ...Object.fromEntries(
    knownTranscriptIds.map((id) => [
      [`/v2/transcript/${id}/sentences`],
      { id, sentences: ['sentence 1'] },
    ]),
  ),
  // transcript subtitles
  ...Object.fromEntries(
    knownTranscriptIds.map((id) => [[`/v2/transcript/${id}/srt`], 'subtitle']),
  ),
  ...Object.fromEntries(
    knownTranscriptIds.map((id) => [[`/v2/transcript/${id}/vtt`], 'subtitle']),
  ),
  // redactions
  ...Object.fromEntries(
    knownTranscriptIds.map((id) => [
      [`/v2/transcript/${id}/redacted-audio`],
      {
        status: 'redacted_audio_ready',
        redacted_audio_url: 'https://some-url.com',
      },
    ]),
  ),
})
