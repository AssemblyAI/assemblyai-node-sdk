/**
 * The details about the current page of an {@link AllTranscriptsResponse}.
 */
export class PageDetails {
  /**
   * Max results to return in a single response, between 1 and 200 inclusive.
   */
  limit?: number;
  /**
   * The number of transcripts returned in the current response.
   */
  result_count?: number;
  /**
   * The url of the current page of results.
   */
  current_url?: string;
  /**
   * The url to get the previous page of results.
   */
  prev_url?: string;
  /**
   * The url to get the next page of results.
   */
  next_url?: string;
}
