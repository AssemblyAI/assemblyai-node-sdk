import type { Axios } from 'axios';
import type { TranscriptResponse } from './transcript-response';
import type { PageDetails } from './page-details';

/**
 * A paginated list of all your transcripts.
 */
export class AllTranscriptsResponse {
  /**
   * Creates an instance of AllTranscriptsResponse.
   * @param authenticatedHttpClient - The authenticated http client used to make the request
   * @param data - The data returned from the initial request
   */
  constructor(authenticatedHttpClient: Axios, data: AllTranscriptsResponse) {
    this.httpClient = authenticatedHttpClient;
    this.page_details = data.page_details as PageDetails;
    this.transcripts = data.transcripts as TranscriptResponse[];
  }

  /**
   * The authenticated http client.
   */
  httpClient: Axios;
  /**
   * The [pageDetails]{@link PageDetails} of the current response.
   */
  page_details?: PageDetails;
  /**
   * A list of the [transcripts]{@link TranscriptResponse} for the current response.
   */
  transcripts?: TranscriptResponse[];

  /**
   * Get the next page of transcript results.
   * @returns A promise that resolves an {@link AllTranscriptsResponse}
   */
  nextPage = async (): Promise<AllTranscriptsResponse> => {
    if (
      this.page_details === undefined ||
      this.page_details.next_url === undefined
    ) {
      throw new Error('You cannot get the next page.');
    }

    const pageDetails: PageDetails = this.page_details;
    const response = await this.httpClient.get(pageDetails.next_url as string);
    return response.data as AllTranscriptsResponse;
  };

  /**
   * Get the previous page of transcript results.
   * @returns A promise that resolves an {@link AllTranscriptsResponse}
   */
  prevPage = async (): Promise<AllTranscriptsResponse> => {
    if (
      this.page_details === undefined ||
      this.page_details.prev_url === undefined
    ) {
      throw new Error('You cannot get the prev page.');
    }

    const pageDetails: PageDetails = this.page_details;
    const response = await this.httpClient.get(pageDetails.prev_url as string);
    return response.data as AllTranscriptsResponse;
  };
}
