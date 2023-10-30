import { AssemblyAI } from "../src";

export const defaultBaseUrl = 'http://localhost:1234';
export const defaultApiKey = 'apikey_123';

export function requestMatches(params: { url: string, method: string }): (input: Request) => boolean {
  return (input: Request) => {
    return defaultBaseUrl + params.url === input.url &&
      params.method === input.method;
  };
}

export const createClient = () => (new AssemblyAI({ baseUrl: defaultBaseUrl, apiKey: defaultApiKey }));
