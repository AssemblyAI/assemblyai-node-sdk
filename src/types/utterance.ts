import type { Word } from './word';

/**
 * A single "turn" in the conversation.
 * A "turn" refers to a change in speakers.
 * Only returned when using the `speaker_labels` or `dual_channel` options.
 */
export class Utterance {
  /**
   * The text of the utterance.
   */
  text?: string;
  /**
   * Starting timestamp (in milliseconds) of the text in the transcript.
   */
  start?: number;
  /**
   * Ending timestamp (in milliseconds) of the text in the transcript.
   */
  end?: number;
  /**
   * The confidence in the transcribed text, between 0.0 and 1.0.
   */
  confidence?: number;
  /**
   * `Speaker A`, `Speaker B`, etc. if using the `speaker_labels` option.
   * `1` or `2` if using the `dual_channel` option.
   */
  speaker?: string;
  /**
   * `1` or `2` if using the `dual_channel` option.
   */
  channel?: string;
  /**
   * An array of the individual [words]{@link Word} in the utterance.
   */
  words?: Word[];
}
