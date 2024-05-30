export * from "./files";
export * from "./transcripts";
export * from "./realtime";
export * from "./services";
export * from "./asyncapi.generated";
export * from "./openapi.generated";
export * from "./deprecated";

export type UserAgentItem = {
  name: string;
  version: string;
};

export type UserAgent = {
  [component: string]: UserAgentItem | undefined | null | false;
};
