import type { ContentSafetyLabel } from './content-safety-label';
import type { Timestamp } from '../timestamp';

/**
 * A piece of spoken audio the Content Safety Detection model flagged.
 */
export class ContentSafetyResult {
  /**
   * The text transcription of what was spoken that triggered the Content Safety Detection Model.
   */
  text?: string;
  /**
   * A list of labels the Content Safety Detection model predicted for the flagged content, as well as the `confidence` and `severity` of each label. The `confidence` score is a range between `0` and `1`, and is how confident the model was in the label it predicted. The `severity` score is also a range `0` and `1`, and indicates how severe the flagged content is, with `1` being most severe.
   */
  labels?: ContentSafetyLabel[];
  /**
   * The start and end time, in milliseconds, for where the flagged content was spoken in the audio.
   */
  timestamp?: Timestamp;
}
