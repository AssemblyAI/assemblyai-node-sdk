import type { IabCategoryLabel } from './iab-category-label';
import type { Timestamp } from '../timestamp';

/**
 * A topic that was predicted for the audio file, including the text that influenced the topic label prediction, and other metadata about relevancy and timestamps.
 */
export class IabCategory {
  /**
   * The transcription text for the portion of audio that was classified with topic labels.
   */
  text?: string;
  /**
   * The list of labels that were predicted for this portion of text. The `relevance` key gives a score between `0` and `1.0` for how relevant each label is for the portion of text.
   */
  labels?: IabCategoryLabel[];
  /**
   * The start and end time, in milliseconds, for where the portion of text in `results.text` was spoken in the audio file.
   */
  timestamp?: Timestamp;
}
