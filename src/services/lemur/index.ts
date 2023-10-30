import {
  LemurSummaryParameters,
  LemurActionItemsParameters,
  LemurQuestionAnswerParameters,
  LemurTaskParameters,
  LemurSummaryResponse,
  LemurQuestionAnswerResponse,
  LemurActionItemsResponse,
  LemurTaskResponse,
  PurgeLemurRequestDataResponse,
} from "../..";
import { BaseService } from "../base";

export class LemurService extends BaseService {
  summary(params: LemurSummaryParameters): Promise<LemurSummaryResponse> {
    return this.fetchJson<LemurSummaryResponse>("/lemur/v3/generate/summary", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  questionAnswer(
    params: LemurQuestionAnswerParameters
  ): Promise<LemurQuestionAnswerResponse> {
    return this.fetchJson<LemurQuestionAnswerResponse>(
      "/lemur/v3/generate/question-answer",
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    );
  }

  actionItems(
    params: LemurActionItemsParameters
  ): Promise<LemurActionItemsResponse> {
    return this.fetchJson<LemurActionItemsResponse>(
      "/lemur/v3/generate/action-items",
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    );
  }

  task(params: LemurTaskParameters): Promise<LemurTaskResponse> {
    return this.fetchJson<LemurTaskResponse>("/lemur/v3/generate/task", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Delete the data for a previously submitted LeMUR request.
   * @param id ID of the LeMUR request
   */
  purgeRequestData(id: string): Promise<PurgeLemurRequestDataResponse> {
    return this.fetchJson<PurgeLemurRequestDataResponse>(`/lemur/v3/${id}`, {
      method: "DELETE",
    });
  }
}
