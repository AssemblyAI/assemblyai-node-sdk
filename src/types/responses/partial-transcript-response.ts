import type { Utterance } from '../utterance';

/**
 * A response object to handle requests to get the sentences or paragraphs of a transcript.
 * https://api.assemblyai.com/v2/transcript/:id/sentences
 * https://api.assemblyai.com/v2/transcript/:id/paragraphs
 */
export class PartialTranscriptResponse {
  /**
   * The unique id of your transcription.
   */
  id?: string;
  /**
   * A list of [utterances]{@link Utterance} where each utterance is an individual sentence from the transcript.
   */
  sentences?: Utterance[];
  /**
   * A list of [utterances]{@link Utterance} where each utterance is an individual paragraph from the transcript.
   */
  paragraphs?: Utterance[];
  /**
   * The confidence in the transcribed text, between 0.0 and 1.0.
   */
  confidence?: number;
  /**
   * The duration of the media file, in seconds.
   */
  audio_duration?: number;
}
