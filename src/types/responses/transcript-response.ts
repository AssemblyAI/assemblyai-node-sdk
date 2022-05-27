import { TranscriptRequest } from '../requests';
import type { SentimentAnalysisResult } from '../sentiment-analysis-result';
import type { IabCategoriesResult } from '../iab-categories';
import type { AutoHighlightsResult } from '../auto-highlights';
import type { ContentSafetyLabels } from '../content-safety';
import type { Entity } from '../entity';
import type { Chapter } from '../chapter';
import type { Utterance } from '../utterance';
import type { Word } from '../word';

/**
 * This is an object representing a transcription. You can create them, retrieve them to see their status and results, and delete them.
 */
export class TranscriptResponse extends TranscriptRequest {
  /**
   * The unique identifier of your transcription.
   */
  id?: string;
  /**
   * The status of your transcription. `queued`, `processing`, `completed`, or `error`
   */
  status?: string;
  /**
   * The error message if the transcript status is `error`.
   */
  error?: string;
  /**
   * The text transcription of your media file.
   */
  text?: string;
  /**
   * A list of all the individual [words]{@link Word} transcribed.
   */
  words?: Word[];
  /**
   * When `dual_channel` or `speaker_labels` is enabled, a list of turn-by-turn utterances.
   */
  utterances?: Utterance[];
  /**
   * The confidence our model has in the transcribed text, between 0.0 and 1.0.
   */
  confidence?: number;
  /**
   * The duration of your media file, in seconds.
   */
  audio_duration?: number;
  /**
   * The status code we received from your server when delivering your webhook.
   */
  webhook_status_code?: string;
  /**
   * The list of results when enabling Automatic Transcript Highlights.
   */
  auto_highlights_result?: AutoHighlightsResult;
  /**
   * The list of results when {@link TranscriptRequest.content_safety} is `true`.
   */
  content_safety_labels?: ContentSafetyLabels;
  /**
   * Enable Topic Detection, can be `true` or `false`.
   */
  iab_categories_result?: IabCategoriesResult;
  /**
   * When Auto Chapters is enabled, the list of Auto Chapters results.
   */
  chapters?: Chapter[];
  /**
   * When Sentiment Analysis is enabled, the list of Sentiment Analysis results.
   */
  sentiment_analysis_results?: SentimentAnalysisResult[];
  /**
   * When Entity Detection is enabled, the list of detected Entities.
   */
  entities?: Entity[];
}
