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
    const serviceParams = { ...params } as Record<string, unknown>;
    if (!serviceParams.token && !serviceParams.apiKey) {
      serviceParams.apiKey = this.rtFactoryParams.apiKey;
    }

    return new RealtimeService(serviceParams as RealtimeServiceParams);
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
