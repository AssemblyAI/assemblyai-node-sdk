import type {
  LiteralUnion,
  Transcript,
  TranscriptParams,
} from "../../src/exports";

// #105: every type a public field is declared with must be reachable from the
// package root. `LiteralUnion` sits behind `language_code` and
// `SyncSpeechModel`; when it was only reachable through the internal path
// `assemblyai/dist/types/helpers`, a downstream package exporting a value of
// such a type failed its declaration emit with TS2742, because that path is
// not in the `exports` map. Naming the types here through the root export is
// the regression check: if the re-export goes, this file stops compiling.
describe("package root exports", () => {
  it("exposes the helper types that public fields are declared with", () => {
    const code: LiteralUnion<"en_us", string> = "en_us";
    const languageOf = (transcript: Transcript) => transcript.language_code;
    const requested = (params: TranscriptParams) => params.language_code;
    expect(code).toBe("en_us");
    expect(typeof languageOf).toBe("function");
    expect(typeof requested).toBe("function");
  });
});
