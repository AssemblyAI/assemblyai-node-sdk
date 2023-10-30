import {
  BaseServiceParams,
  RealtimeTokenParams,
  CreateRealtimeServiceParams,
  RealtimeServiceParams,
  RealtimeTemporaryTokenResponse,
} from "../..";
import { RealtimeService } from "./service";
import { BaseService } from "../base";

export class RealtimeServiceFactory extends BaseService {
  private rtFactoryParams: BaseServiceParams;
  constructor(params: BaseServiceParams) {
    super(params);
    this.rtFactoryParams = params;
  }

  createService(params?: CreateRealtimeServiceParams): RealtimeService {
    if (!params) params = { apiKey: this.rtFactoryParams.apiKey };
    else if (!("token" in params) && !params.apiKey) {
      params.apiKey = this.rtFactoryParams.apiKey;
    }

    return new RealtimeService(params as RealtimeServiceParams);
  }

  async createTemporaryToken(params: RealtimeTokenParams) {
    const data = await this.fetchJson<RealtimeTemporaryTokenResponse>(
      "/v2/realtime/token",
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    );
    return data.token;
  }
}
