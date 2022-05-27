/**
 * With Sentiment Analysis, AssemblyAI can detect the sentiment of each sentence of speech spoken in your audio files.
 * Sentiment Analysis returns a result of POSITIVE, NEGATIVE, or NEUTRAL for each sentence in the transcript.
 *
 * To include Sentiment Analysis in your transcript results, add the sentiment_analysis parameter in your POST request
 * when submitting files for transcription and set this parameter to true, as shown in the cURL request on the right.
 *
 * Once the transcription is complete, and you get the result, there will be an additional key sentiment_analysis_results
 * in the JSON response.
 *
 * For each sentence in the transcription text, the API will return the sentiment, confidence score, the start and end
 * time for when that sentence was spoken, and, if applicable, the speaker label for that sentence.
 * A detailed explanation of each key in the list of objects returned in the sentiment_analysis_results
 * array can be found in the below table.
 */
export class SentimentAnalysisResult {
  /**
   * The transcription text of the sentence being analyzed
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
   * The detected sentiment POSITIVE, NEGATIVE, or NEUTRAL.
   */
  sentiment?: string;
  /**
   * Confidence score for the detected sentiment, between 0.0 and 1.0.
   */
  confidence?: number;
  /**
   * `Speaker A`, `Speaker B`, etc. if using the `speaker_labels` option.
   * `1` or `2` if using the `dual_channel` option.
   */
  speaker?: string | null;
}
