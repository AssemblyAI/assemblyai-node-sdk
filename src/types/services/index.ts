import { UserAgent } from "..";

type BaseServiceParams = {
  apiKey: string;
  baseUrl?: string;
  streamingBaseUrl?: string;
  syncBaseUrl?: string;
  dictationBaseUrl?: string;
  llmGatewayBaseUrl?: string;
  /** The Text-to-Speech API base URL. Defaults to `https://tts.us.assemblyai.com`; `https://tts.eu.assemblyai.com` keeps requests in the EU. */
  ttsBaseUrl?: string;
  /**
   * The AssemblyAI user agent to use for requests.
   * The provided components will be merged into the default AssemblyAI user agent.
   * If `false`, the AssemblyAI user agent will be removed.
   */
  userAgent?: UserAgent | false;
};

export type { BaseServiceParams };
