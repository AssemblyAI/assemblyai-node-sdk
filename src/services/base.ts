import { BaseServiceParams } from "..";
import { Error as JsonError } from "..";
import { buildUserAgent } from "../utils/userAgent";

/**
 * Base class for services that communicate with the API.
 */
export abstract class BaseService {
  private userAgent: string | undefined;
  /**
   * Create a new service.
   * @param params - The parameters to use for the service.
   */
  constructor(private params: BaseServiceParams) {
    if (params.userAgent === false) {
      this.userAgent = undefined;
    } else {
      this.userAgent = buildUserAgent(params.userAgent || {});
    }
  }
  protected async fetch(
    input: string,
    init?: RequestInit | undefined,
  ): Promise<Response> {
    init = init ?? {};
    let headers = init.headers ?? {};
    headers = {
      Authorization: this.params.apiKey,
      "Content-Type": "application/json",
      ...init.headers,
    };

    if (this.userAgent) {
      (headers as Record<string, string>)["User-Agent"] = this.userAgent;
      // chromium browsers have a bug where the user agent can't be modified
      if (typeof window !== "undefined" && "chrome" in window) {
        (headers as Record<string, string>)["AssemblyAI-Agent"] =
          this.userAgent;
      }
    }
    init.headers = headers;

    init.cache = "no-store";
    if (!input.startsWith("http")) input = this.params.baseUrl + input;

    const response = await fetch(input, init);

    if (response.status >= 400) {
      let json: JsonError | undefined;
      const text = await response.text();
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          /* empty */
        }
        if (json?.error) throw new Error(json.error);
        throw new Error(text);
      }
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  protected async fetchJson<T>(
    input: string,
    init?: RequestInit | undefined,
  ): Promise<T> {
    const response = await this.fetch(input, init);
    return response.json() as Promise<T>;
  }
}
