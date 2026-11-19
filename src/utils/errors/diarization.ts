/**
 * Error thrown when a diarization request fails.
 */
export class DiarizationError extends Error {
  override name = "DiarizationError";

  /**
   * Create a new DiarizationError.
   * @param message - The human-readable error message: the problem-details
   * `detail` from the server.
   * @param status - The HTTP status code of the failed request (401 for a
   * missing or invalid key, 400 for a validation failure, 413, 415, 5xx).
   * @param errorCode - Machine-readable code — the snake_cased
   * problem-details `title` from the server (e.g. `unauthorized`,
   * `bad_request`).
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
