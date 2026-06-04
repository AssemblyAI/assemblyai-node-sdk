import { WritableStream } from "#streams";
import {
  PolyfillWebSocket,
  factory as polyfillWebSocketFactory,
} from "#websocket";
import { ErrorEvent, MessageEvent, CloseEvent } from "ws";
import { conditions } from "#conditions";
import {
  ChannelAttributionParams,
  StreamingEvents,
  StreamingListeners,
  StreamingTranscriberParams,
  AudioData,
  BeginEvent,
  StreamingEventMessage,
  TurnEvent,
  LLMGatewayResponseEvent,
  SpeakerRevisionEvent,
  StreamingUpdateConfiguration,
  StreamingForceEndpoint,
  WarningEvent,
} from "../..";
import type { VadDetector, VadFrame } from "../../types/streaming/dual-channel";
import { EnergyVad } from "./energy-vad";
import { attributeTurn, rollUpTurnChannel, VadTimeline } from "./label-mapper";
import { StreamingError, StreamingErrorMessages } from "../../utils/errors";
import { StreamingErrorTypeCodes } from "../../utils/errors/streaming";

/**
 * Options for `sendAudio`. In dual-channel mode (when `channels` is configured
 * on the transcriber), `channel` is required and must match one of the declared
 * channel names; in single-channel mode it is ignored.
 */
export type SendAudioOptions = {
  channel?: string;
};

/**
 * View any `AudioData` (ArrayBuffer / ArrayBufferView / typed array) as a
 * little-endian Int16 sample sequence without copying. Callers must guarantee
 * the underlying byte length is even.
 */
function toInt16View(audio: AudioData): Int16Array {
  // AudioData is ArrayBufferLike per the public type, but in practice callers
  // pass ArrayBuffer or a typed-array view. Handle both without copying.
  if (audio instanceof Int16Array) return audio;
  if (ArrayBuffer.isView(audio)) {
    const view = audio as ArrayBufferView;
    return new Int16Array(
      view.buffer,
      view.byteOffset,
      Math.floor(view.byteLength / 2),
    );
  }
  return new Int16Array(audio as ArrayBuffer);
}

const defaultStreamingUrl = "wss://streaming.assemblyai.com/v3/ws";
const terminateSessionMessage = `{"type":"Terminate"}`;

/**
 * Per-send chunk cap in milliseconds for the dual-channel mixer. The streaming
 * server rejects audio messages longer than 1000 ms (`Input Duration Error`).
 * If a backlog accumulates (e.g. when a browser tab is backgrounded and
 * `setInterval` is throttled to ~1 Hz), `flushMix` loops and emits multiple
 * sends each ≤ this cap until the buffers drain.
 */
const MAX_CHUNK_MS = 200;

/**
 * Per-send minimum chunk size in milliseconds. The streaming server also
 * rejects audio messages shorter than 50 ms with the same
 * `Input Duration Error`, so the mixer waits until both per-channel buffers
 * have at least this much accumulated before emitting. Final-flush (close
 * path) bypasses this floor so the trailing partial buffer still gets sent.
 */
const MIN_CHUNK_MS = 50;

type BufferLike =
  | string
  | Buffer
  | DataView
  | number
  | ArrayBufferView
  | Uint8Array
  | ArrayBuffer
  | SharedArrayBuffer
  | ReadonlyArray<unknown>
  | ReadonlyArray<number>
  | { valueOf(): ArrayBuffer }
  | { valueOf(): SharedArrayBuffer }
  | { valueOf(): Uint8Array }
  | { valueOf(): ReadonlyArray<number> }
  | { valueOf(): string }
  | { [Symbol.toPrimitive](hint: string): string };

export class StreamingTranscriber {
  private apiKey?: string;
  private token?: string;
  private params: StreamingTranscriberParams;

  private socket?: PolyfillWebSocket;
  private listeners: StreamingListeners = {};
  private sessionTerminatedResolve?: () => void;

  // Dual-channel mode state (allocated only when params.channels is set).
  private isDualChannel = false;
  private channelNames?: string[];
  private channelBuffers?: Map<string, number[]>;
  private channelSamplesReceived?: Map<string, number>;
  private channelVadFloatBuffers?: Map<string, Float32Array>;
  private channelVadBufferIdx?: Map<string, number>;
  private channelVads?: Map<string, VadDetector>;
  private timeline?: VadTimeline;
  private flushTimer?: ReturnType<typeof setInterval>;
  private attributionParams?: Required<ChannelAttributionParams>;
  private vadFrameSamples = 0;
  private minChunkSamples = 0;
  private maxChunkSamples = 0;
  // For resolveUnknownChannelsMethod === "speaker-history": per-speaker_label
  // cumulative active-VAD RMS per channel. Allocated only when that method is
  // configured.
  private speakerHistory?: Map<string, Map<string, number>>;

  constructor(params: StreamingTranscriberParams) {
    this.params = {
      ...params,
      websocketBaseUrl: params.websocketBaseUrl || defaultStreamingUrl,
    };

    if ("token" in params && params.token) this.token = params.token;
    if ("apiKey" in params && params.apiKey) this.apiKey = params.apiKey;

    if (!(this.token || this.apiKey)) {
      throw new Error("API key or temporary token is required.");
    }

    if (params.channels) {
      if (params.channels.length !== 2) {
        throw new Error(
          "StreamingTranscriber.channels must have exactly 2 entries.",
        );
      }
      const names = params.channels.map((c) => c.name);
      if (new Set(names).size !== names.length) {
        throw new Error("StreamingTranscriber.channels names must be unique.");
      }
      this.isDualChannel = true;
      this.channelNames = names;
      const att = params.channelAttribution ?? {};
      this.attributionParams = {
        dominanceRatio: att.dominanceRatio ?? 4,
        timelineWindowMs: att.timelineWindowMs ?? 30_000,
        createVad: att.createVad ?? (() => new EnergyVad()),
        flushIntervalMs: att.flushIntervalMs ?? 50,
        resolveUnknownChannelsMethod:
          att.resolveUnknownChannelsMethod ?? "window",
        resolutionWindowWords: att.resolutionWindowWords ?? 2,
        speakerHistoryMinRmsEvidence: att.speakerHistoryMinRmsEvidence ?? 0.5,
        speakerHistoryDominanceRatio: att.speakerHistoryDominanceRatio ?? 3,
      };
      if (
        this.attributionParams.resolveUnknownChannelsMethod ===
        "speaker-history"
      ) {
        this.speakerHistory = new Map();
      }
      // 20 ms VAD frames at the transcriber's target sample rate.
      this.vadFrameSamples = Math.max(1, Math.round(params.sampleRate * 0.02));
      this.minChunkSamples = Math.max(
        1,
        Math.round(params.sampleRate * (MIN_CHUNK_MS / 1000)),
      );
      this.maxChunkSamples = Math.max(
        this.minChunkSamples,
        Math.round(params.sampleRate * (MAX_CHUNK_MS / 1000)),
      );
      this.channelBuffers = new Map(names.map((n) => [n, [] as number[]]));
      this.channelSamplesReceived = new Map(names.map((n) => [n, 0]));
      this.channelVadFloatBuffers = new Map(
        names.map((n) => [n, new Float32Array(this.vadFrameSamples)]),
      );
      this.channelVadBufferIdx = new Map(names.map((n) => [n, 0]));
      this.channelVads = new Map(
        names.map((n) => [n, this.attributionParams!.createVad(n)]),
      );
      this.timeline = new VadTimeline(this.attributionParams.timelineWindowMs);
    }
  }

  private connectionUrl(): URL {
    const url = new URL(this.params.websocketBaseUrl ?? "");

    if (url.protocol !== "wss:") {
      throw new Error("Invalid protocol, must be wss");
    }

    const searchParams = new URLSearchParams();

    if (this.token) {
      searchParams.set("token", this.token);
    }

    searchParams.set("sample_rate", this.params.sampleRate.toString());

    if (this.params.endOfTurnConfidenceThreshold) {
      searchParams.set(
        "end_of_turn_confidence_threshold",
        this.params.endOfTurnConfidenceThreshold.toString(),
      );
    }

    if (this.params.minEndOfTurnSilenceWhenConfident !== undefined) {
      if (this.params.minTurnSilence !== undefined) {
        console.warn(
          "[Deprecation Warning] Both `minEndOfTurnSilenceWhenConfident` and `minTurnSilence` are set. Using `minTurnSilence`; `minEndOfTurnSilenceWhenConfident` is deprecated.",
        );
      } else {
        console.warn(
          "[Deprecation Warning] `minEndOfTurnSilenceWhenConfident` is deprecated and will be removed in a future release. Please use `minTurnSilence` instead.",
        );
      }
    }
    const effectiveMinTurnSilence =
      this.params.minTurnSilence ??
      this.params.minEndOfTurnSilenceWhenConfident;
    if (effectiveMinTurnSilence !== undefined) {
      searchParams.set("min_turn_silence", effectiveMinTurnSilence.toString());
    }

    if (this.params.maxTurnSilence) {
      searchParams.set(
        "max_turn_silence",
        this.params.maxTurnSilence.toString(),
      );
    }

    if (this.params.vadThreshold !== undefined) {
      searchParams.set("vad_threshold", this.params.vadThreshold.toString());
    }

    if (this.params.formatTurns) {
      searchParams.set("format_turns", this.params.formatTurns.toString());
    }

    if (this.params.encoding) {
      searchParams.set("encoding", this.params.encoding.toString());
    }

    if (this.params.keytermsPrompt) {
      searchParams.set(
        "keyterms_prompt",
        JSON.stringify(this.params.keytermsPrompt),
      );
    } else if (this.params.keyterms) {
      console.warn(
        "[Deprecation Warning] `keyterms` is deprecated and will be removed in a future release. Please use `keytermsPrompt` instead.",
      );
      searchParams.set("keyterms_prompt", JSON.stringify(this.params.keyterms));
    }

    if (this.params.prompt) {
      searchParams.set("prompt", this.params.prompt);
    }

    if (this.params.agentContext) {
      searchParams.set("agent_context", this.params.agentContext);
    }

    if (this.params.filterProfanity) {
      searchParams.set(
        "filter_profanity",
        this.params.filterProfanity.toString(),
      );
    }

    if (this.params.speechModel === "u3-pro") {
      console.warn(
        "[Deprecation Warning] The speech model `u3-pro` is deprecated and will be removed in a future release. Please use `u3-rt-pro` instead.",
      );
    }
    if (this.params.speechModel !== undefined) {
      searchParams.set("speech_model", this.params.speechModel.toString());
    }

    if (this.params.languageDetection !== undefined) {
      searchParams.set(
        "language_detection",
        this.params.languageDetection.toString(),
      );
    }

    if (this.params.domain) {
      searchParams.set("domain", this.params.domain);
    }

    if (this.params.inactivityTimeout !== undefined) {
      searchParams.set(
        "inactivity_timeout",
        this.params.inactivityTimeout.toString(),
      );
    }

    if (this.params.speakerLabels !== undefined) {
      searchParams.set("speaker_labels", this.params.speakerLabels.toString());
    }

    if (this.params.maxSpeakers !== undefined) {
      searchParams.set("max_speakers", this.params.maxSpeakers.toString());
    }

    if (this.params.voiceFocus) {
      searchParams.set("voice_focus", this.params.voiceFocus);
    }

    if (this.params.voiceFocusThreshold !== undefined) {
      searchParams.set(
        "voice_focus_threshold",
        this.params.voiceFocusThreshold.toString(),
      );
    }

    if (this.params.continuousPartials !== undefined) {
      searchParams.set(
        "continuous_partials",
        this.params.continuousPartials.toString(),
      );
    }

    if (this.params.interruptionDelay !== undefined) {
      searchParams.set(
        "interruption_delay",
        this.params.interruptionDelay.toString(),
      );
    }

    if (this.params.turnLeftPadMs !== undefined) {
      searchParams.set(
        "turn_left_pad_ms",
        this.params.turnLeftPadMs.toString(),
      );
    }

    if (this.params.customerSupportAudioCapture) {
      console.warn(
        "`customerSupportAudioCapture=true` will record session audio. Only enable this when explicitly coordinating with AssemblyAI support.",
      );
      // The server's canonical wire name is `_customer_support_audio_capture`
      // (leading underscore = "not officially supported / unstable"). The
      // server also accepts `customer_support_audio_capture` via
      // `populate_by_name=True`, but we send the underscore form to honor
      // the server's stability marker.
      searchParams.set(
        "_customer_support_audio_capture",
        this.params.customerSupportAudioCapture.toString(),
      );
    }

    if (this.params.webhookUrl) {
      searchParams.set("webhook_url", this.params.webhookUrl);
    }

    if (this.params.webhookAuthHeaderName) {
      searchParams.set(
        "webhook_auth_header_name",
        this.params.webhookAuthHeaderName,
      );
    }

    if (this.params.webhookAuthHeaderValue) {
      searchParams.set(
        "webhook_auth_header_value",
        this.params.webhookAuthHeaderValue,
      );
    }

    if (this.params.includePartialTurns !== undefined) {
      searchParams.set(
        "include_partial_turns",
        this.params.includePartialTurns.toString(),
      );
    }

    if (this.params.redactPii !== undefined) {
      searchParams.set("redact_pii", this.params.redactPii.toString());
    }

    if (this.params.redactPiiPolicies !== undefined) {
      searchParams.set(
        "redact_pii_policies",
        JSON.stringify(this.params.redactPiiPolicies),
      );
    }

    if (this.params.redactPiiSub !== undefined) {
      searchParams.set("redact_pii_sub", this.params.redactPiiSub);
    }

    if (this.params.mode !== undefined) {
      searchParams.set("mode", this.params.mode);
    }

    if (this.params.llmGateway !== undefined) {
      searchParams.set("llm_gateway", JSON.stringify(this.params.llmGateway));
    }

    url.search = searchParams.toString();

    return url;
  }

  on(event: "open", listener: (event: BeginEvent) => void): void;
  on(event: "turn", listener: (event: TurnEvent) => void): void;
  on(
    event: "llmGatewayResponse",
    listener: (event: LLMGatewayResponseEvent) => void,
  ): void;
  on(
    event: "speakerRevision",
    listener: (event: SpeakerRevisionEvent) => void,
  ): void;
  on(event: "warning", listener: (event: WarningEvent) => void): void;
  on(event: "vad", listener: (event: VadFrame) => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "close", listener: (code: number, reason: string) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: StreamingEvents, listener: (...args: any[]) => void) {
    this.listeners[event] = listener;
  }

  connect() {
    return new Promise<BeginEvent>((resolve) => {
      if (this.socket) {
        throw new Error("Already connected");
      }

      const url = this.connectionUrl();

      if (this.token) {
        this.socket = polyfillWebSocketFactory(url.toString());
      } else {
        if (conditions.browser) {
          console.warn(
            `API key authentication is not supported for the StreamingTranscriber in browser environment. Use temporary token authentication instead.
Learn more at https://github.com/AssemblyAI/assemblyai-node-sdk/blob/main/docs/compat.md#browser-compatibility.`,
          );
        }

        this.socket = polyfillWebSocketFactory(url.toString(), {
          headers: { Authorization: this.apiKey },
        });
      }

      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = () => {};

      this.socket.onclose = ({ code, reason }: CloseEvent) => {
        if (!reason) {
          if (code in StreamingErrorMessages) {
            reason = StreamingErrorMessages[code as StreamingErrorTypeCodes];
          }
        }
        // Stop the flush timer when the socket is gone (server-initiated close,
        // network drop, etc.) — otherwise subsequent ticks call send() on a
        // closed socket and spam the error listener.
        if (this.flushTimer) {
          clearInterval(this.flushTimer);
          this.flushTimer = undefined;
        }
        this.listeners.close?.(code, reason);
      };

      this.socket.onerror = (event: ErrorEvent) => {
        if (event.error) this.listeners.error?.(event.error as Error);
        else this.listeners.error?.(new Error(event.message));
      };

      this.socket.onmessage = ({ data }: MessageEvent) => {
        const message = JSON.parse(data.toString()) as StreamingEventMessage;

        if ("error" in message) {
          const err = new StreamingError(message.error);
          if ("error_code" in message) {
            (err as StreamingError & { code?: number }).code =
              message.error_code;
          }
          this.listeners.error?.(err);
          return;
        }

        switch (message.type) {
          case "Begin": {
            resolve(message);
            this.listeners.open?.(message);
            break;
          }
          case "Turn": {
            if (this.isDualChannel && this.timeline && this.attributionParams) {
              attributeTurn(message, this.timeline, {
                dominanceRatio: this.attributionParams.dominanceRatio,
              });
              switch (this.attributionParams.resolveUnknownChannelsMethod) {
                case "window":
                  this.resolveUnknownChannelsByWindow(message);
                  break;
                case "speaker-history":
                  this.resolveUnknownChannelsBySpeakerHistory(message);
                  break;
                case "none":
                  // Leave "unknown" words as-is.
                  break;
              }
            }
            this.listeners.turn?.(message);
            break;
          }
          case "SpeechStarted": {
            this.listeners.speechStarted?.(message);
            break;
          }
          case "LLMGatewayResponse": {
            this.listeners.llmGatewayResponse?.(message);
            break;
          }
          case "SpeakerRevision": {
            this.listeners.speakerRevision?.(message);
            break;
          }
          case "Warning": {
            const warning = message as WarningEvent;
            console.warn(
              `Streaming warning (code=${warning.warning_code}): ${warning.warning}`,
            );
            this.listeners.warning?.(warning);
            break;
          }
          case "Termination": {
            this.sessionTerminatedResolve?.();
            break;
          }
        }
      };
    });
  }

  /**
   * Returns a WritableStream that pumps PCM chunks into `sendAudio`. Single-channel
   * only — in dual-channel mode use `sendAudio(pcm, { channel })` directly, since
   * `WritableStream` has no place to carry a channel tag.
   */
  stream(): WritableStream<AudioData> {
    return new WritableStream<AudioData>({
      write: (chunk: AudioData) => {
        this.sendAudio(chunk);
      },
    });
  }

  /**
   * Send PCM audio.
   *
   * In single-channel mode, `audio` is forwarded directly to the WebSocket and
   * `options` is ignored.
   *
   * In dual-channel mode (when `channels` is configured), `options.channel` is
   * REQUIRED and must match one of the declared channel names. Per-channel PCM is
   * fed into that channel's VAD, accumulated into a per-channel ring buffer, and
   * a scheduled flush (`channelAttribution.flushIntervalMs`, default 50ms) mixes
   * the buffers into mono before sending to the WebSocket.
   */
  sendAudio(audio: AudioData, options?: SendAudioOptions) {
    if (!this.isDualChannel) {
      this.send(audio);
      return;
    }
    if (!options?.channel) {
      throw new Error(
        "StreamingTranscriber is in dual-channel mode; sendAudio requires { channel }.",
      );
    }
    if (!this.channelNames!.includes(options.channel)) {
      throw new Error(
        `Unknown channel "${options.channel}"; declared channels: ${this.channelNames!.join(", ")}.`,
      );
    }
    this.ingestChannelAudio(options.channel, audio);
  }

  private ingestChannelAudio(name: string, audio: AudioData) {
    const samples = toInt16View(audio);
    const buf = this.channelBuffers!.get(name)!;
    const vadBuf = this.channelVadFloatBuffers!.get(name)!;
    let vadIdx = this.channelVadBufferIdx!.get(name)!;
    let received = this.channelSamplesReceived!.get(name)!;
    const vad = this.channelVads!.get(name)!;
    const sampleRate = this.params.sampleRate;
    const frameSize = this.vadFrameSamples;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      buf.push(s);
      vadBuf[vadIdx++] = s / 0x8000;
      received++;
      if (vadIdx === frameSize) {
        const result = vad.process(vadBuf);
        const frame: VadFrame = {
          ts: (received / sampleRate) * 1000,
          channel: name,
          active: result.active,
          rms: result.energy,
        };
        this.timeline!.pushFrame(frame);
        this.listeners.vad?.(frame);
        vadIdx = 0;
      }
    }

    this.channelVadBufferIdx!.set(name, vadIdx);
    this.channelSamplesReceived!.set(name, received);

    if (!this.flushTimer) this.startFlushTimer();
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(
      () => this.flushMix(),
      this.attributionParams!.flushIntervalMs,
    );
  }

  private flushMix(force = false) {
    if (!this.channelNames || !this.channelBuffers) return;
    const bufs = this.channelNames.map((n) => this.channelBuffers!.get(n)!);
    const divisor = bufs.length;
    // Loop so a backlog (e.g. accumulated while a browser tab was throttled in
    // the background) drains as multiple sends, each capped at MAX_CHUNK_MS.
    // Without the cap a single message could exceed the server's 1000 ms input
    // duration limit and be rejected with code 3007.
    for (;;) {
      let mixLen = Infinity;
      for (const b of bufs) if (b.length < mixLen) mixLen = b.length;
      if (!Number.isFinite(mixLen) || mixLen === 0) return;
      // The streaming server rejects audio messages shorter than 50 ms with
      // `Input Duration Error`. Wait until both per-channel buffers have at
      // least minChunkSamples worth queued before emitting. The `force` path
      // (final flush on close) bypasses this so the trailing partial buffer
      // still gets through.
      if (!force && mixLen < this.minChunkSamples) return;
      if (mixLen > this.maxChunkSamples) mixLen = this.maxChunkSamples;
      const out = new Int16Array(mixLen);
      for (let i = 0; i < mixLen; i++) {
        let sum = 0;
        for (let c = 0; c < divisor; c++) sum += bufs[c][i];
        const avg = Math.round(sum / divisor);
        out[i] = avg < -32768 ? -32768 : avg > 32767 ? 32767 : avg;
      }
      for (const b of bufs) b.splice(0, mixLen);
      try {
        this.send(out.buffer);
      } catch (err) {
        this.listeners.error?.(err as Error);
        return;
      }
    }
  }

  /**
   * Fill in words whose per-word VAD attribution was `"unknown"` by looking
   * at the dominant non-`"unknown"` channel among ±N neighbors in the same
   * turn. Words with no non-`"unknown"` neighbors stay `"unknown"`. Confident
   * per-word VAD decisions are never modified.
   *
   * Local temporal heuristic — ignores `speaker_label`, so it works even when
   * AAI's diarization re-uses the same label for two physically distinct
   * voices. Each resolved word gets `channelResolved: true` so downstream
   * renderers can distinguish inferred channels from directly-measured ones.
   */
  private resolveUnknownChannelsByWindow(turn: TurnEvent): void {
    if (!this.attributionParams) return;
    const window = this.attributionParams.resolutionWindowWords;
    const words = turn.words;
    let mutated = false;

    for (let i = 0; i < words.length; i++) {
      if (words[i].channel !== "unknown") continue;
      const tally = new Map<string, number>();
      const lo = Math.max(0, i - window);
      const hi = Math.min(words.length - 1, i + window);
      for (let j = lo; j <= hi; j++) {
        if (j === i) continue;
        const ch = words[j].channel;
        if (!ch || ch === "unknown") continue;
        tally.set(ch, (tally.get(ch) ?? 0) + 1);
      }
      if (tally.size === 0) continue;

      // Pick the dominant neighbor channel. Ties → leave `"unknown"` (rare;
      // would require an equal count of mic and system neighbors).
      let top: string | undefined;
      let topCount = 0;
      let tied = false;
      for (const [name, count] of tally) {
        if (count > topCount) {
          top = name;
          topCount = count;
          tied = false;
        } else if (count === topCount) {
          tied = true;
        }
      }
      if (top && !tied) {
        words[i].channel = top;
        words[i].channelResolved = true;
        mutated = true;
      }
    }

    // Recompute the rollup only if any per-word channel changed.
    if (mutated) turn.channel = rollUpTurnChannel(words);
  }

  /**
   * Fill `"unknown"` words by looking up the speaker's session-wide channel
   * evidence. For each `speaker_label`, sums active VAD frame RMS per channel
   * across every word the speaker has uttered to date. A speaker is
   * "resolvable" if their total evidence clears
   * `speakerHistoryMinRmsEvidence` and their top channel exceeds the
   * runner-up by `speakerHistoryDominanceRatio`.
   *
   * Only touches `"unknown"` words. Confident per-word VAD decisions are
   * never modified. `speaker_label` is never modified.
   */
  private resolveUnknownChannelsBySpeakerHistory(turn: TurnEvent): void {
    if (!this.timeline || !this.attributionParams || !this.speakerHistory)
      return;
    const minEvidence = this.attributionParams.speakerHistoryMinRmsEvidence;
    const dominanceRatio = this.attributionParams.speakerHistoryDominanceRatio;

    // 1. Accumulate evidence from this turn's words.
    for (const w of turn.words) {
      if (!w.speaker) continue;
      const frames = this.timeline.framesInWindow(w.start, w.end);
      let entry = this.speakerHistory.get(w.speaker);
      if (!entry) {
        entry = new Map();
        this.speakerHistory.set(w.speaker, entry);
      }
      for (const f of frames) {
        if (!f.active) continue;
        entry.set(f.channel, (entry.get(f.channel) ?? 0) + f.rms);
      }
    }

    // 2. Fill unknown words whose speakers have dominant evidence.
    let mutated = false;
    for (const w of turn.words) {
      if (w.channel !== "unknown" || !w.speaker) continue;
      const entry = this.speakerHistory.get(w.speaker);
      if (!entry || entry.size === 0) continue;
      let total = 0;
      let topName: string | undefined;
      let topScore = 0;
      let runnerScore = 0;
      for (const [name, score] of entry) {
        total += score;
        if (score > topScore) {
          runnerScore = topScore;
          topScore = score;
          topName = name;
        } else if (score > runnerScore) {
          runnerScore = score;
        }
      }
      if (total < minEvidence) continue;
      if (runnerScore > 0 && topScore < dominanceRatio * runnerScore) continue;
      if (topName) {
        w.channel = topName;
        w.channelResolved = true;
        mutated = true;
      }
    }

    if (mutated) turn.channel = rollUpTurnChannel(turn.words);
  }

  /**
   * Update the streaming configuration mid-stream.
   * @param config - The configuration parameters to update
   */
  updateConfiguration(config: Omit<StreamingUpdateConfiguration, "type">) {
    const {
      min_end_of_turn_silence_when_confident,
      min_turn_silence,
      ...rest
    } = config;
    if (min_end_of_turn_silence_when_confident !== undefined) {
      if (min_turn_silence !== undefined) {
        console.warn(
          "[Deprecation Warning] Both `min_end_of_turn_silence_when_confident` and `min_turn_silence` are set. Using `min_turn_silence`; `min_end_of_turn_silence_when_confident` is deprecated.",
        );
      } else {
        console.warn(
          "[Deprecation Warning] `min_end_of_turn_silence_when_confident` is deprecated and will be removed in a future release. Please use `min_turn_silence` instead.",
        );
      }
    }
    const effective =
      min_turn_silence ?? min_end_of_turn_silence_when_confident;
    const message: StreamingUpdateConfiguration = {
      type: "UpdateConfiguration",
      ...rest,
      ...(effective !== undefined ? { min_turn_silence: effective } : {}),
    };
    this.send(JSON.stringify(message));
  }

  /**
   * Force the current turn to end immediately.
   */
  forceEndpoint() {
    const message: StreamingForceEndpoint = {
      type: "ForceEndpoint",
    };
    this.send(JSON.stringify(message));
  }

  private send(data: BufferLike) {
    if (!this.socket || this.socket.readyState !== this.socket.OPEN) {
      throw new Error("Socket is not open for communication");
    }
    this.socket.send(data);
  }

  async close(waitForSessionTermination = true) {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
      // Best-effort: drain any final partial mix so the server gets the tail.
      // Bypass the 50ms floor here since this is the last flush; if the tail
      // is <50ms the server will reject that single message, but we'd lose
      // the audio either way.
      this.flushMix(true);
    }
    if (this.socket) {
      if (this.socket.readyState === this.socket.OPEN) {
        if (waitForSessionTermination) {
          const sessionTerminatedPromise = new Promise<void>((resolve) => {
            this.sessionTerminatedResolve = resolve;
          });
          this.socket.send(terminateSessionMessage);
          await sessionTerminatedPromise;
        } else {
          this.socket.send(terminateSessionMessage);
        }
      }
      if (this.socket?.removeAllListeners) this.socket.removeAllListeners();
      this.socket.close();
    }

    this.listeners = {};
    this.socket = undefined;
  }
}
