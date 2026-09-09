/**
 * Error thrown when a request to the LLM Gateway fails.
 */
export class LlmGatewayError extends Error {
  override name = "LlmGatewayError";

  /**
   * Create a new LlmGatewayError.
   * @param message - The human-readable error message.
   * @param status - The HTTP status code of the failed request.
   * @param requestId - The server-generated request id, for correlating with support.
   * @param errors - Validation detail strings, present on invalid-request errors.
   */
  constructor(
    message: string,
    public readonly status?: number,
    public readonly requestId?: string,
    public readonly errors?: string[],
  ) {
    super(message);
  }
}
