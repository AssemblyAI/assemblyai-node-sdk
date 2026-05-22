import { StreamingTranscriber } from "../service";
import { BrowserOnlyError } from "../../../types/streaming/dual-channel";

export { BrowserOnlyError } from "../../../types/streaming/dual-channel";
import {
  PCM16_ENCODER_PROCESSOR_NAME,
  Pcm16EncoderMessage,
  pcm16EncoderWorkletSource,
} from "./worklets/pcm16-encoder";

const DEFAULT_TARGET_RATE = 16_000;
const DEFAULT_CHUNK_MS = 50;
const MIC_CHANNEL = "mic";
const SYSTEM_CHANNEL = "system";

type ErrorListener = (err: Error) => void;

export type DualChannelCaptureParams = {
  /** Microphone MediaStream. Caller should set `echoCancellation: true` at `getUserMedia` time. */
  micStream: MediaStream;
  /** System-audio MediaStream (e.g. `getDisplayMedia({ audio: true })`). */
  systemStream: MediaStream;
  /**
   * The transcriber to push tagged PCM into. MUST be constructed with
   * `channels: [{ name: "mic" }, { name: "system" }]` so the per-channel
   * `sendAudio` calls succeed.
   */
  transcriber: StreamingTranscriber;
  /**
   * Target sample rate sent to the transcriber. Defaults to 16000. The
   * AudioContext runs at the device's native rate; resampling happens inside
   * the encoder worklet (forcing `AudioContext({ sampleRate })` is unreliable
   * across browsers).
   */
  targetSampleRate?: number;
};

/**
 * Browser-only adapter that pumps two `MediaStream`s into a `StreamingTranscriber`
 * configured for dual-channel mode. Each `MediaStream` runs through its own
 * `pcm16-encoder` AudioWorklet (resample to `targetSampleRate`, encode to Int16
 * PCM); each PCM chunk is forwarded via `transcriber.sendAudio(pcm, { channel })`.
 *
 * All dual-channel orchestration (mixing, VAD, per-word attribution) lives inside
 * `StreamingTranscriber` — this class is a pure I/O adapter. Non-browser runtimes
 * can replicate its job by pushing tagged PCM into `transcriber.sendAudio` directly.
 *
 * Caller responsibilities:
 * - **Echo cancellation** is set at `getUserMedia` time (`audio: { echoCancellation: true }`).
 * - **System-audio capture** is platform-dependent. Chrome's `getDisplayMedia({ audio: true })`
 *   captures tab audio (and on Windows, full system audio when sharing the whole screen).
 *   macOS requires a virtual loopback driver (e.g. BlackHole) to expose system audio at all.
 * - **Token auth.** Construct the transcriber with `token` — API-key auth is unsupported in browsers.
 * - **Stream ownership.** `stop()` tears down the AudioContext but does NOT stop the
 *   `MediaStreamTrack`s passed in — callers own those.
 */
export class DualChannelCapture {
  private readonly params: Required<
    Omit<DualChannelCaptureParams, "targetSampleRate">
  > & { targetSampleRate: number };
  private errorListener?: ErrorListener;
  private context?: AudioContext;
  private micSource?: MediaStreamAudioSourceNode;
  private sysSource?: MediaStreamAudioSourceNode;
  private micEncoder?: AudioWorkletNode;
  private sysEncoder?: AudioWorkletNode;
  private running = false;

  constructor(params: DualChannelCaptureParams) {
    if (typeof globalThis.AudioContext === "undefined") {
      throw new BrowserOnlyError();
    }
    this.params = {
      micStream: params.micStream,
      systemStream: params.systemStream,
      transcriber: params.transcriber,
      targetSampleRate: params.targetSampleRate ?? DEFAULT_TARGET_RATE,
    };
  }

  on(event: "error", listener: ErrorListener): void {
    if (event === "error") this.errorListener = listener;
  }

  /**
   * Wire the capture pipeline and start pumping tagged PCM into the transcriber.
   * The transcriber must already be connected. Returns once the worklet is
   * registered and the audio graph is live.
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error("DualChannelCapture already started");
    }
    this.context = new AudioContext();

    const blob = new Blob([pcm16EncoderWorkletSource], {
      type: "application/javascript",
    });
    const url = URL.createObjectURL(blob);
    try {
      await this.context.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    this.micSource = this.context.createMediaStreamSource(
      this.params.micStream,
    );
    this.sysSource = this.context.createMediaStreamSource(
      this.params.systemStream,
    );

    this.micEncoder = this.makeEncoder(MIC_CHANNEL);
    this.sysEncoder = this.makeEncoder(SYSTEM_CHANNEL);
    this.micSource.connect(this.micEncoder);
    this.sysSource.connect(this.sysEncoder);

    this.running = true;
  }

  private makeEncoder(channel: string): AudioWorkletNode {
    const node = new AudioWorkletNode(
      this.context!,
      PCM16_ENCODER_PROCESSOR_NAME,
      {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
        channelCountMode: "explicit",
        channelInterpretation: "speakers",
        processorOptions: {
          targetRate: this.params.targetSampleRate,
          chunkMs: DEFAULT_CHUNK_MS,
        },
      },
    );
    node.port.onmessage = (e: MessageEvent<Pcm16EncoderMessage>) => {
      try {
        this.params.transcriber.sendAudio(e.data.pcm, { channel });
      } catch (err) {
        this.errorListener?.(err as Error);
      }
    };
    return node;
  }

  /**
   * Tear down internal nodes and close the AudioContext. Does NOT stop the
   * caller-provided MediaStream tracks — they remain available for preview UI,
   * recording, etc. Idempotent.
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    try {
      this.micEncoder?.port.close();
      this.sysEncoder?.port.close();
      this.micEncoder?.disconnect();
      this.sysEncoder?.disconnect();
      this.micSource?.disconnect();
      this.sysSource?.disconnect();
    } catch {
      // Disconnecting already-disconnected nodes throws in some browsers; ignore.
    }

    if (this.context && this.context.state !== "closed") {
      await this.context.close();
    }

    this.context = undefined;
    this.micSource = undefined;
    this.sysSource = undefined;
    this.micEncoder = undefined;
    this.sysEncoder = undefined;
  }
}
