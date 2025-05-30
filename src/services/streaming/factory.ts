import {
  BaseServiceParams,
  StreamingTokenParams,
  StreamingTranscriberParams,
  StreamingTemporaryTokenResponse,
} from "../..";
import { StreamingTranscriber } from "./service";
import { BaseService } from "../base";

export class StreamingTranscriberFactory extends BaseService {
  constructor(params: BaseServiceParams) {
    super(params);
  }

  transcriber(params: StreamingTranscriberParams): StreamingTranscriber {
    return new StreamingTranscriber(params);
  }

  async createTemporaryToken(params: StreamingTokenParams) {
    const searchParams = new URLSearchParams();

    // Add each param to the search params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    const url = queryString ? `/v3/token?${queryString}` : "/v3/token";

    const data = await this.fetchJson<StreamingTemporaryTokenResponse>(url, {
      method: "GET",
    });
    return data.token;
  }
}

export class StreamingServiceFactory extends StreamingTranscriberFactory {}
