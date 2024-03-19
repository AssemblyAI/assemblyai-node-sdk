import { BaseServiceParams } from "..";
import { Error as JsonError } from "..";

/**
 * Base class for services that communicate with the API.
 */
export abstract class BaseService {
  /**
   * Create a new service.
   * @param params - The parameters to use for the service.
   */
  constructor(private params: BaseServiceParams) {}
  protected async fetch(
    input: string,
    init?: RequestInit | undefined,
  ): Promise<Response> {
    init = init ?? {};
    init.headers = init.headers ?? {};
    init.headers = {
      Authorization: this.params.apiKey,
      "Content-Type": "application/json",
      ...init.headers,
    };
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
