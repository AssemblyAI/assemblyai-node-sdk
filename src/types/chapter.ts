/**
 * **Auto Chapters** provides a "summary over time" for audio files transcribed with AssemblyAI.
 * It works by first segmenting your audio files into logical "chapters" as the topic of conversation changes,
 * and then provides an automatically generated summary for each "chapter" of content.
 *
 * For more information on **Auto Chapters**, check out the [announcement on our blog](https://www.assemblyai.com/blog/introducing-assemblyai-auto-chapters-summarize-audio-and-video-files).
 *
 * When submitting a file for transcription, simply include the `auto_chapters` parameter in your `POST` request, and set this to `true`.
 *
 * When your [transcription is completed](/walkthroughs#getting-the-transcription-result "null"), you'll see a `chapters` key in the JSON response, as shown on the right. For each chapter that was detected, the API will include the `start` and `end` timestamps (in milliseconds), a `summary` - which is a few sentence summary of the content spoken during that timeframe, a short `headline`, which can be thought of as a "summary of the summary", and a `gist`, which is an ultra-short, few word summary of the chapter of content.
 */
export class Chapter {
  /**
   * Starting timestamp (in milliseconds) of the portion of audio being summarized.
   */
  start?: number;
  /**
   * Ending timestamp (in milliseconds) of the portion of audio being summarized.
   */
  end?: number;
  /**
   * An ultra-short summary, just a few words, of the content spoken during this timeframe.
   */
  gist?: string;
  /**
   * A single sentence summary of the content spoken during this timeframe.
   */
  headline?: string;
  /**
   * An ultra-short summary, just a few words, of the content spoken during this timeframe.
   */
  summary?: string;
}
