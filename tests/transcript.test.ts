import { knownTranscriptIds } from './__mocks__/api'
import axios, { withData } from './__mocks__/axios'
import AssemblyAI from '../src'
import path from "path"

const testDir = process.env["TESTDATA_DIR"] ?? '.'

const assembly = new AssemblyAI({
  apiKey: '',
})

const transcriptId = knownTranscriptIds[0]
const remoteAudioURL =
  'https://storage.googleapis.com/aai-web-samples/espn-bears.m4a'
const badRemoteAudioURL =
  'https://storage.googleapis.com/aai-web-samples/does-not-exist.m4a'

describe('core', () => {
  it('should create the transcript object with a remote url', async () => {
    const transcript = await assembly.transcripts.create(
      {
        audio_url: remoteAudioURL,
      },
      {
        poll: false
      },
    )

    expect(transcript.status).toBeTruthy()
    expect(transcript.status).not.toBe('error')
    expect(transcript.status).not.toBe('complete')
  })

  it('should create the transcript object with a local file', async () => {
    const transcript = await assembly.transcripts.create(
      {
        audio_url: path.join(testDir, 'gore.wav'),
      },
      {
        poll: false
      },
    )

    expect(['processing', 'queued']).toContain(transcript.status)
  }, 60_000)

  it('should get the transcript object', async () => {
    const fetched = await assembly.transcripts.get(transcriptId)

    expect(fetched.id).toBeTruthy()
  })

  it('should poll the transcript object', async () => {
    axios.get.mockResolvedValueOnce(withData({ status: 'queued' }))
    axios.get.mockResolvedValueOnce(withData({ status: 'processing' }))
    axios.get.mockResolvedValueOnce(withData({ status: 'completed' }))
    const transcript = await assembly.transcripts.create(
      {
        audio_url: remoteAudioURL,
      },
      {
        pollingInterval: 1000,
        pollingTimeout: 5000,
      },
    )

    expect(transcript.status).toBe('completed')
  }, 6000)

  it('should list the transcript objects', async () => {
    const page = await assembly.transcripts.list()
    expect(page.transcripts).toBeInstanceOf(Array)
    expect(page.page_details).not.toBeNull()
  })

  it('should delete the transcript object', async () => {
    axios.delete.mockResolvedValueOnce(withData({ id: transcriptId }))
    const deleted = await assembly.transcripts.delete(transcriptId)

    expect(axios.delete).toHaveBeenLastCalledWith(
      `/v2/transcript/${transcriptId}`,
    )
    expect(deleted.id).toBe(transcriptId)
  })
})

describe('failures', () => {
  it('should fail to create the transcript object', async () => {
    const errorResponse = { status: 'error' }
    axios.post.mockResolvedValueOnce(withData(errorResponse))
    const created = await assembly.transcripts.create(
      {
        audio_url: badRemoteAudioURL,
      },
      {
        poll: false
      },
    )

    expect(created).toBe(errorResponse)
    expect(axios.post).toHaveBeenLastCalledWith('/v2/transcript', {
      audio_url: badRemoteAudioURL,
    })
  })

  it('should fail to poll', async () => {
    const promise = assembly.transcripts.create(
      {
        audio_url: badRemoteAudioURL,
      },
      {
        pollingInterval: 1_000,
        pollingTimeout: 1_000,
      },
    )

    await expect(promise).rejects.toThrow('Polling timeout')
  })

  it('should get paragraphs', async () => {
    const segment = await assembly.transcripts.paragraphs(transcriptId)

    expect(segment.paragraphs).toBeInstanceOf(Array)
    expect(segment.paragraphs.length).toBeGreaterThan(0)
  })

  it('should get sentences', async () => {
    const segment = await assembly.transcripts.sentences(transcriptId)

    expect(segment.sentences).toBeInstanceOf(Array)
    expect(segment.sentences.length).toBeGreaterThan(0)
  })

  it('should get srt subtitles', async () => {
    const subtitle = await assembly.transcripts.subtitles(transcriptId, 'srt')

    expect(subtitle).toBeTruthy()
  })

  it('should get vtt subtitles', async () => {
    const subtitle = await assembly.transcripts.subtitles(transcriptId, 'vtt')

    expect(subtitle).toBeTruthy()
  })

  it('should create a redactable transcript object', async () => {
    const transcript = await assembly.transcripts.create(
      {
        audio_url:
          'https://storage.googleapis.com/aai-web-samples/espn-bears.m4a',
        redact_pii: true,
        redact_pii_audio: true,
        redact_pii_policies: ['person_age', 'date_of_birth', 'phone_number'],
        redact_pii_audio_quality: 'mp3',
      },
      {
        poll: false
      },
    )

    expect(['processing', 'queued']).toContain(transcript.status)
  })

  it('should get redactions', async () => {
    const res = await assembly.transcripts.redactions(transcriptId)

    expect(res.status).toBe('redacted_audio_ready')
    expect(res.redacted_audio_url).toBeTruthy()
  })

  it('should word search', async () => {
    const res = await assembly.transcripts.wordSearch(transcriptId, ['bears'])

    expect(res.id).toBe(transcriptId)
    expect(res.total_count).toBe(1)
    expect(res.matches).toBeInstanceOf(Array)
  })
})
