import {
  LemurSummaryParams,
  LemurActionItemsParams,
  LemurQuestionAnswerParams,
  LemurTaskParams,
  LemurSummaryResponse,
  LemurQuestionAnswerResponse,
  LemurActionItemsResponse,
  LemurTaskResponse,
  PurgeLemurRequestDataResponse,
  LemurResponse,
} from "../..";
import { BaseService } from "../base";

export class LemurService extends BaseService {
  summary(params: LemurSummaryParams): Promise<LemurSummaryResponse> {
    return this.fetchJson<LemurSummaryResponse>("/lemur/v3/generate/summary", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  questionAnswer(
    params: LemurQuestionAnswerParams,
  ): Promise<LemurQuestionAnswerResponse> {
    return this.fetchJson<LemurQuestionAnswerResponse>(
      "/lemur/v3/generate/question-answer",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  }

  actionItems(
    params: LemurActionItemsParams,
  ): Promise<LemurActionItemsResponse> {
    return this.fetchJson<LemurActionItemsResponse>(
      "/lemur/v3/generate/action-items",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  }

  task(params: LemurTaskParams): Promise<LemurTaskResponse> {
    return this.fetchJson<LemurTaskResponse>("/lemur/v3/generate/task", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Retrieve a LeMUR response that was previously generated.
   * @param id - The ID of the LeMUR request you previously made. This would be found in the response of the original request.
   * @returns The LeMUR response.
   */
  getResponse<T extends LemurResponse>(id: string): Promise<T>;
  getResponse(id: string): Promise<LemurResponse>;
  getResponse(id: string): Promise<LemurResponse> {
    return this.fetchJson<LemurResponse>(`/lemur/v3/${id}`);
  }

  /**
   * Delete the data for a previously submitted LeMUR request.
   * @param id - ID of the LeMUR request
   */
  purgeRequestData(id: string): Promise<PurgeLemurRequestDataResponse> {
    return this.fetchJson<PurgeLemurRequestDataResponse>(`/lemur/v3/${id}`, {
      method: "DELETE",
    });
  }
}
