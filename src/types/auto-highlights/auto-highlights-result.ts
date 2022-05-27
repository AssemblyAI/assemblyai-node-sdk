import type { AutoHighlight } from './auto-highlight';

/**
 * With **Automatic Transcript Highlights**, the AssemblyAI API can automatically detect important phrases and words in your transcription text.
 *
 * For example, consider the following text:
 *
 * ```
 *     We smirk because we believe that synthetic happiness is not of the same quality as what we might call natural happiness. What are these terms? Natural happiness is what we get when we get what we wanted. And synthetic happiness is what we make when we don't get what we wanted. And in our society...
 * ```
 *
 * **Automatic Transcript Highlights** will automatically detect the following key phrases/words in the text:
 *
 * ```
 *     "synthetic happiness"
 *     "natural happiness"
 *     ...
 * ```
 *
 * To enable this feature, simply include the `auto_highlights` parameter in your `POST` request when submitting files for transcription, and set this parameter to `true`.
 *
 * ---
 *
 * **Heads up**
 *
 * Your files can take up to 60 seconds longer to process when **Automatic Transcript Highlights** is enabled.
 *
 * ---
 *
 * Once your transcription is complete, and you [`GET` the result](/walkthroughs#getting-the-transcription-result "null"), you'll see an `auto_highlights_result` key in the JSON response.
 *
 * The `auto_highlights_result` key in the JSON response will contain the key phrases/words the API found in your transcription text. Here is a close-up of just that key's response, and what each value means:
 */
export class AutoHighlightsResult {
  /**
   * Will be either `"success"`, or `"unavailable"` in the rare case that the Automatic Transcript Highlights model failed.
   */
  status?: string;
  /**
   * A list of all the highlights found in your transcription text.
   */
  results?: AutoHighlight[];
}
