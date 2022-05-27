import type { Word } from '../word';

/**
 * The response from a call to the `/v2/stream` endpoint.
 * The {@link AssemblyClient.stream} function returns this response.
 */
export class StreamResponse {
  /**
   * The unique id of your transcription.
   */
  id?: string;
  /**
   * The status of your transcription.
   */
  status?: string;
  /**
   * The complete transcription for your audio.
   */
  text?: string;
  /**
   * The confidence score of the entire transcription, between 0 and 1.
   */
  confidence?: number;
  /**
   * An array of objects, with the information for each [word]{@link Word} in the transcription text. Will include the start/end time (in milliseconds) of the word and the confidence score of the word.
   */
  words?: Word[];
  /**
   * The timestamp for your request.
   */
  created?: Date;
}
