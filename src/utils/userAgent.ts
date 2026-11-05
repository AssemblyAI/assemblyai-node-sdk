import { UserAgent } from "../types";

declare const Deno:
  | {
      version: {
        deno: string;
      };
    }
  | undefined;

type EnvironmentDetectors = {
  process?: {
    versions?: {
      node?: string;
      bun?: string;
    };
  };
  deno?: {
    version?: {
      deno?: string;
    };
  };
  navigator?: {
    userAgent?: string;
  };
};

export const detectDefaultUserAgent = (
  env: EnvironmentDetectors = {
    process: typeof process !== "undefined" ? process : undefined,
    deno: typeof Deno !== "undefined" ? Deno : undefined,
    navigator: typeof navigator !== "undefined" ? navigator : undefined,
  },
): { userAgentString: string; defaultUserAgent: UserAgent } => {
  let userAgentString = "";
  if (env.navigator?.userAgent) {
    userAgentString += env.navigator.userAgent;
  }

  const defaultAgent: UserAgent = {
    sdk: { name: "JavaScript", version: "__SDK_VERSION__" },
  };

  if (env.deno?.version?.deno) {
    defaultAgent.runtime_env = {
      name: "Deno",
      version: env.deno.version.deno,
    };
  } else if (env.process?.versions?.bun) {
    defaultAgent.runtime_env = {
      name: "Bun",
      version: env.process.versions.bun,
    };
  } else if (env.process?.versions?.node) {
    defaultAgent.runtime_env = {
      name: "Node",
      version: env.process.versions.node,
    };
  }

  return { userAgentString, defaultUserAgent: defaultAgent };
};

const detected = detectDefaultUserAgent();
const defaultUserAgentString = detected.userAgentString;
const defaultUserAgent = detected.defaultUserAgent;

export const buildUserAgent = (userAgent: UserAgent | false) =>
  defaultUserAgentString +
  (userAgent === false
    ? ""
    : " AssemblyAI/1.0 (" +
      Object.entries({ ...defaultUserAgent, ...userAgent })
        .map(([key, item]) =>
          item ? `${key}=${item.name}/${item.version}` : "",
        )
        .join(" ") +
      ")");
