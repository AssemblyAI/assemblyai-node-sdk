import {
  BrowserOnlyError,
  DualChannelCapture,
} from "../../src/services/streaming/browser/dual-channel-capture";
import { StreamingTranscriber } from "../../src/services/streaming/service";

describe("DualChannelCapture in non-browser env", () => {
  it("throws BrowserOnlyError when AudioContext is missing", () => {
    // jest runs with testEnvironment: "node", so globalThis.AudioContext is undefined.
    expect(
      () =>
        new DualChannelCapture({
          micStream: undefined as unknown as MediaStream,
          systemStream: undefined as unknown as MediaStream,
          transcriber: undefined as unknown as StreamingTranscriber,
        }),
    ).toThrow(BrowserOnlyError);
  });
});
