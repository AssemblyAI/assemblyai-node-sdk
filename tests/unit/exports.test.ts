import type {
  LiteralUnion,
  TextToSpeechErrorFields,
  TextToSpeechRequest,
  TextToSpeechRequestOptions,
  TextToSpeechResponse,
  TextToSpeechResponseInfo,
  TextToSpeechStream,
  Transcript,
  TranscriptParams,
} from "../../src/exports";
import { AssemblyAI, TextToSpeechError } from "../../src/exports";

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

  it("exposes the fields type of the TextToSpeechError constructor", () => {
    // `TextToSpeechErrorFields` is the constructor's second argument and the
    // class implements it, so a downstream declaration that names the
    // constructor's parameters needs it from the root.
    const fields: TextToSpeechErrorFields = {
      status: 429,
      errorCode: "rate_limited",
      retryable: true,
      retryAfter: 2,
    };
    const args: ConstructorParameters<typeof TextToSpeechError> = [
      "Too many requests",
      fields,
    ];
    const error = new TextToSpeechError(...args);
    const carried: TextToSpeechErrorFields = error;
    expect(carried.errorCode).toBe("rate_limited");
    expect(carried.retryAfter).toBe(2);
  });

  it("exposes the HTTP text-to-speech types under the product's prefix", () => {
    // The root also exports speech-to-text types such as `SpeechModel` and
    // `SpeechUnderstandingRequest`, so the types `synthesize()` and
    // `stream()` are declared with carry the `TextToSpeech` prefix.
    const client = new AssemblyAI({ apiKey: "key" });
    const synthesize: (
      request: TextToSpeechRequest,
      options?: TextToSpeechRequestOptions,
    ) => Promise<TextToSpeechResponse> = client.tts.synthesize.bind(client.tts);
    const stream: (
      request: TextToSpeechRequest,
      options?: TextToSpeechRequestOptions,
    ) => Promise<TextToSpeechStream> = client.tts.stream.bind(client.tts);
    const infoOf = (speech: TextToSpeechStream): TextToSpeechResponseInfo =>
      speech.info;
    const response: TextToSpeechResponse = {
      audio: new Uint8Array(2),
      requestId: "req-1",
    };
    const info: TextToSpeechResponseInfo = response;
    expect(typeof synthesize).toBe("function");
    expect(typeof stream).toBe("function");
    expect(typeof infoOf).toBe("function");
    expect(info.requestId).toBe("req-1");
  });
});
