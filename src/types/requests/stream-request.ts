/**
 * The request used with the {@link AssemblyClient.stream} function.
 */
export class StreamRequest {
  /**
   * Raw audio data, base64 encoded. This can be the raw data recorded directly from a microphone or read from a wav file.
   * @example UklGRtjIAABXQVZFZ...
   */
  audio_data?: string;
  /**
   * This is set to `false` by default; however, a developer can add auto formatting of text by setting it to `true`.
   * @example `true`
   */
  format_text?: boolean;
  /**
   * This is set to `false` by default; however, a developer can add auto punctuation by setting it to `true`.
   * @example `true`
   */
  punctuate?: boolean;
}
