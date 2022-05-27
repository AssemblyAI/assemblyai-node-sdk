import axios from 'axios';
import { asyncPoll } from 'poll-func';
import { AllTranscriptsResponse } from './types';
import type {
  PartialTranscriptResponse,
  StreamRequest,
  StreamResponse,
  TranscriptRequest,
  TranscriptResponse,
  UploadRequestResponse,
} from './types';
import type { Axios } from 'axios';

/**
 * The AssemblyAI client that allows you to call the AssemblyAI V2 endpoints via various functions.
 */
export class AssemblyClient {
  /**
   * Creates an instance of AssemblyClient.
   * @param apiKey - Your API key to authenticate to AssemblyAI.
   *
   * @returns a new {@link AssemblyClient}.
   */
  public constructor(apiKey: string) {
    this.httpClient = axios.create({
      baseURL: 'https://api.assemblyai.com/v2',
      headers: {
        authorization: apiKey,
        'content-type': 'application/json',
      },
    });
  }

  /**
   * The Axios http client used to make requests to the AssemblyAI API.
   */
  private readonly httpClient: Axios;

  /**
   * Upload an audio file to AssemblyAI for transcription.
   * The transcript can then be downloaded via {@link getTranscript}, {@link pollForTranscript}, {@link getTranscriptSentences}, {@link getTranscriptParagraphs}, and {@link getAllTranscripts}.
   *
   * @param audioUrl - A URL that points to your audio file, accessible only by AssemblyAI's servers.
   *
   * @returns An {@link UploadRequestResponse} with the audio_url used.
   */
  upload = async (audioUrl: string): Promise<UploadRequestResponse> => {
    const request: UploadRequestResponse = { upload_url: audioUrl };

    const response = await this.httpClient.post<UploadRequestResponse>(
      '/upload',
      request,
      {
        headers: { 'transfer-encoding': 'chunked' },
      },
    );

    return response.data;
  };

  /**
   * Create a transcript.
   * The transcript can then be downloaded via {@link getTranscript}, {@link pollForTranscript}, {@link getTranscriptSentences}, {@link getTranscriptParagraphs}, and {@link getAllTranscripts}.
   *
   * @param request - A {@link TranscriptRequest} with your transcription options.
   *
   * @returns A {@link TranscriptResponse} of an incomplete transcript.
   */
  createTranscript = async (
    request: TranscriptRequest,
  ): Promise<TranscriptResponse> => {
    const response = await this.httpClient.post<TranscriptResponse>(
      '/transcript',
      request,
    );
    return response.data;
  };

  /**
   * Get the detailed information of a specific transcript by id.
   *
   * @param transcriptId - The unique identifier of your transcription.
   *
   * @returns A {@link TranscriptResponse} of the full transcript object no matter it's status.
   */
  getTranscript = async (transcriptId: string): Promise<TranscriptResponse> => {
    const response = await this.httpClient.get<TranscriptResponse>(
      `/transcript/${transcriptId}`,
    );
    return response.data;
  };

  /**
   * Poll for a transcript.
   *
   * @param transcriptId - The unique identifier of your transcription.
   * @param pollTimeout - The amount of time to poll for before timing out.
   * @param pollInterval - The amount of time in ms to wait between each call to see if the transcript is complete.
   *
   * @returns A {@link TranscriptResponse} when the transcript {@link TranscriptResponse.status} === `completed`.
   */
  pollForTranscript = async (
    transcriptId: string,
    pollTimeout: number = 10 * 60 * 1000,
    pollInterval: number = 5 * 1000,
  ): Promise<TranscriptResponse> => {
    return asyncPoll<TranscriptResponse>(
      async () => {
        const response = await this.httpClient.get<TranscriptResponse>(
          `/transcript/${transcriptId}`,
        );
        return response.data;
      },
      (data: TranscriptResponse) => data.status === 'completed',
      pollInterval,
      pollTimeout,
    );
  };

  /**
   * Query for just the sentences of a transcript.
   *
   * @param transcriptId - The unique identifier of your transcription.
   *
   * @returns A {@link PartialTranscriptResponse} with the sentences of the transcript as a list of [utterances]{@link Utterance}.
   */
  getTranscriptSentences = async (
    transcriptId: string,
  ): Promise<PartialTranscriptResponse> => {
    const response = await this.httpClient.get<PartialTranscriptResponse>(
      `/transcript/${transcriptId}/sentences`,
    );
    return response.data;
  };

  /**
   * Query for just the paragraphs of a transcript.
   *
   * @param transcriptId - The unique identifier of your transcription.
   *
   * @returns A {@link PartialTranscriptResponse} with the paragraphs of the transcript as a list of [utterances]{@link Utterance}.
   */
  getTranscriptParagraphs = async (
    transcriptId: string,
  ): Promise<PartialTranscriptResponse> => {
    const response = await this.httpClient.get<PartialTranscriptResponse>(
      `/transcript/${transcriptId}/paragraphs`,
    );
    return response.data;
  };

  /**
   * List all your transcripts.
   *
   * @param limit - Max results to return in a single response, between `1` and `200` inclusive.
   * @param status - Filter by transcript status, `"processing"`, `"queued"`, `"completed"`, or `"error"`.
   * @param createdOn - Only return transcripts created on this date; format: `"YYYY-MM-DD"`.
   * @param beforeId - Return transcripts that were created before this transcript id.
   * @param afterId - Return transcripts that were created after this transcript id.
   * @param throttledOnly - Only return throttled transcripts, overrides status filter.
   *
   * @returns A paginated {@link AllTranscriptsResponse} with {@link limit} transcript results.
   */
  getAllTranscripts = async (
    limit = 10,
    status = '',
    createdOn = '',
    beforeId = '',
    afterId = '',
    throttledOnly = false,
  ): Promise<AllTranscriptsResponse> => {
    let requestUtl = `/transcript?limit=${limit}&throttled_only=${String(
      throttledOnly,
    )}`;

    if (status !== '') {
      requestUtl += `&status=${status}`;
    }
    if (createdOn !== '') {
      requestUtl += `&created_on=${createdOn}`;
    }
    if (beforeId !== '') {
      requestUtl += `&before_id=${beforeId}`;
    }
    if (afterId !== '') {
      requestUtl += `&after_id=${afterId}`;
    }

    const response = await this.httpClient.get<AllTranscriptsResponse>(
      requestUtl,
    );

    const responseData: AllTranscriptsResponse = response.data;
    return new AllTranscriptsResponse(this.httpClient, responseData);
  };

  /**
   * Permanently delete a transcript by id. The record of the transcript will exist and remain queryable, however, all fields containing sensitive data (like text transcriptions) will be permanently deleted.
   *
   * @param transcriptId - The unique identifier of your transcription.
   */
  deleteTranscript = async (
    transcriptId: string,
  ): Promise<TranscriptResponse> => {
    const response = await this.httpClient.delete<TranscriptResponse>(
      `/transcript/${transcriptId}`,
    );
    return response.data;
  };

  /**
   * If you're working with short bursts of audio, less than 15 seconds, you can send the audio data directly to the `/v2/stream` endpoint which will return a transcript to you within a few hundred milliseconds, directly in the request-response loop.
   *
   * ## Audio Requirements
   *
   * The audio data you send to this endpoint has to comply with a strict format. This is because we don't do any transcoding to your data, we send it directly to the model for transcription. You can send the content of a `.wav` file to this endpoint, or raw data read directly from a microphone. Either way, you must record your audio in the following format to use this endpoint:
   *
   * *   16-bit Signed Integer PCM encoding (ie, a .wav file)
   * *   8khz sampling rate
   * *   128kbps bitrate
   * *   16-bit Precision
   * *   Single channel
   * *   Headless (ie, strip any headers from wav files)
   * *   15 seconds or less of audio per request
   *
   * @param request - A {@link StreamRequest}
   *
   * @returns A {@link StreamResponse}. Depending on how much audio data you send, the API will respond within 100-750 milliseconds.
   */
  stream = async (request: StreamRequest): Promise<StreamResponse> => {
    const response = await this.httpClient.post<StreamResponse>(
      '/stream',
      request,
    );
    return response.data;
  };
}
