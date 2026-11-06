import { conditions } from "#conditions";
import { DEFAULT_FETCH_INIT } from "#fetch";
import { BaseServiceParams, Error as JsonError } from "..";
import { buildUserAgent } from "../utils/userAgent";
import { AssemblyAIError } from "../utils/errors";

/**
 * Base class for services that communicate with the API.
 */
export abstract class BaseService {
  /** The User-Agent the client sends, or `undefined` with `userAgent: false`. */
  protected readonly userAgent: string | undefined;
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
  protected async fetchResponse(
    input: string,
    init?: RequestInit | undefined,
  ): Promise<Response> {
    init = { ...DEFAULT_FETCH_INIT, ...init };
    let headers: Record<string, string> = {
      Authorization: this.params.apiKey,
    };
    // FormData bodies must let fetch set the multipart boundary itself.
    if (!(init.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (DEFAULT_FETCH_INIT?.headers)
      headers = { ...headers, ...DEFAULT_FETCH_INIT.headers };
    if (init?.headers)
      headers = { ...headers, ...(init.headers as Record<string, string>) };

    if (this.userAgent) {
      headers["User-Agent"] = this.userAgent;
      if (conditions.browser || conditions.default) {
        // chromium browsers have a bug where the user agent can't be modified
        if (typeof window !== "undefined" && "chrome" in window) {
          headers["AssemblyAI-Agent"] = this.userAgent;
        }
      }
    }
    init.headers = headers;

    if (!input.startsWith("http")) input = this.params.baseUrl + input;

    return await fetch(input, init);
  }

  protected async fetch(
    input: string,
    init?: RequestInit | undefined,
  ): Promise<Response> {
    const response = await this.fetchResponse(input, init);

    if (response.status >= 400) {
      let message: string | undefined;
      const text = await response.text();
      if (text) {
        try {
          const json: JsonError = JSON.parse(text);
          if (json?.error) message = json.error;
        } catch {
          /* empty */
        }
        if (!message) message = text;
      }
      if (!message) {
        message = `HTTP Error: ${response.status} ${response.statusText}`;
      }

      const retryHeader = response.headers.get("retry-after");
      const retryAfter =
        retryHeader && /^\d+$/.test(retryHeader)
          ? parseInt(retryHeader, 10)
          : undefined;

      throw new AssemblyAIError(message, response.status, retryAfter);
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
