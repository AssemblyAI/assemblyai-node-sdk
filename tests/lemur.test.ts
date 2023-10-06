import { knownTranscriptIds } from './__mocks__/api'
import AssemblyAI from '../src'

const assembly = new AssemblyAI({
  apiKey: '',
})

describe('lemur', () => {
  it('should generate a summary', async () => {
    const { response } = await assembly.lemur.summary({
      final_model: 'basic',
      transcript_ids: knownTranscriptIds,
      answer_format: 'one sentence',
    })

    expect(response).toBeTruthy()
  }, 15_000)

  it('should generate an answer', async () => {
    const { response } = await assembly.lemur.questionAnswer({
      final_model: 'basic',
      transcript_ids: knownTranscriptIds,
      questions: [
        {
          question: 'What are they discussing?',
          answer_format: 'text',
        },
      ],
    })

    expect(response).toBeTruthy()
    expect(response).toHaveLength(1)
  }, 15_000)

  it('should generate action items', async () => {
    const { response } = await assembly.lemur.actionItems({
      final_model: 'basic',
      transcript_ids: knownTranscriptIds,
    })

    expect(response).toBeTruthy()
  }, 15_000)

  it('should generate a task', async () => {
    const { response } = await assembly.lemur.task({
      final_model: 'basic',
      transcript_ids: knownTranscriptIds,
      prompt: 'Write a haiku about this conversation.',
    })

    expect(response).toBeTruthy()
  }, 15_000)

  it('should fail to generate a summary', async () => {
    const promise = assembly.lemur.summary({
      final_model: 'basic',
      transcript_ids: ['bad-id'],
      answer_format: 'one sentence',
    })

    await expect(promise).rejects.toBe(
      'each transcript source id must be valid',
    )
  })
})