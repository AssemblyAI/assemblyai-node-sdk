import type { Timestamp } from '../timestamp';

/**
 * A highlight found in your transcription text.
 */
export class AutoHighlight {
  /**
   * How many times this phrase occurred in the text.
   */
  count?: number;
  /**
   * The relevancy of this phrase - the higher the score, the better.
   */
  rank?: number;
  /**
   * The phrase/word itself that was detected.
   */
  text?: string;
  /**
   * A list of all the timestamps, in milliseconds, in the audio where each phrase/word is spoken.
   */
  timestamps?: Timestamp[];
}
