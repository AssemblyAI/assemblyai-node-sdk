/**
 * Error thrown when an AssemblyAI API request fails.
 */
export class AssemblyAIError extends Error {
  override name = "AssemblyAIError";

  /**
   * Create a new AssemblyAIError.
   * @param message - The human-readable error message.
   * @param status - The HTTP status code of the failed request.
   * @param retryAfter - Seconds to wait before retrying, from the
   * `Retry-After` header on 429/503 responses if present.
   */
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}
