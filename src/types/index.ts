export * from "./sync";
export * from "./dictation";
export * from "./llm-gateway";
export * from "./files";
export * from "./transcripts";
export * from "./realtime";
export * from "./asyncapi.generated";
export * from "./streaming";
export * from "./services";
export * from "./openapi.generated";
export * from "./deprecated";
// Utility types that public fields are declared with (`LiteralUnion` behind
// `language_code`, `SyncSpeechModel`, ...). They must be reachable from the
// package root: a downstream package that exports a value of such a type has
// its declaration emit fail with TS2742 otherwise, because the internal path
// `assemblyai/dist/types/helpers` is not in the `exports` map (#105).
export * from "./helpers";

export type UserAgentItem = {
  name: string;
  version: string;
};

export type UserAgent = {
  [component: string]: UserAgentItem | undefined | null | false;
};
