/**
 * Error thrown when a dictation request fails.
 */
export class DictationError extends Error {
  override name = "DictationError";

  /**
   * Create a new DictationError.
   * @param message - The human-readable error message.
   * @param status - The HTTP status code of the failed request.
   * @param errorCode - Machine-readable code — the snake_cased
   * problem-details `title` from the server (e.g. `bad_audio`,
   * `audio_too_large`, `capacity_exceeded`, `inference_timeout`).
   * @param retryAfter - Seconds to wait before retrying, from the
   * `Retry-After` header on 429/503 responses.
   */
  constructor(
    message: string,
    public readonly status?: number,
    public readonly errorCode?: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}
