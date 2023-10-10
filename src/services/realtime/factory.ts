import {
  BaseServiceParams,
  RealtimeTokenParams,
  CreateRealtimeServiceParams,
  RealtimeServiceParams,
} from "@/types";
import { AxiosInstance } from "axios";
import { RealtimeService } from "./service";

export class RealtimeServiceFactory {
  constructor(
    private client: AxiosInstance,
    private params: BaseServiceParams
  ) {}

  createService(params?: CreateRealtimeServiceParams): RealtimeService {
    if (!params) params = { apiKey: this.params.apiKey };
    else if (!("token" in params) && !params.apiKey) {
      params.apiKey = this.params.apiKey;
    }

    return new RealtimeService(params as RealtimeServiceParams);
  }

  async createTemporaryToken(params: RealtimeTokenParams) {
    const response = await this.client.post<{ token: string }>(
      "/v2/realtime/token",
      params
    );
    return response.data.token;
  }
}
