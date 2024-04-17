import { WritableStream } from "#streams";
import WebSocket from "#ws";
import { ErrorEvent, MessageEvent, CloseEvent } from "ws";
import {
  RealtimeEvents,
  RealtimeListeners,
  RealtimeTranscriberParams,
  RealtimeMessage,
  RealtimeTranscript,
  PartialTranscript,
  FinalTranscript,
  SessionBeginsEventData,
  AudioEncoding,
  AudioData,
  SessionInformation,
} from "../..";
import {
  RealtimeError,
  RealtimeErrorMessages,
  RealtimeErrorType,
} from "../../utils/errors";

const defaultRealtimeUrl = "wss://api.assemblyai.com/v2/realtime/ws";
const forceEndOfUtteranceMessage = `{"force_end_utterance":true}`;
const terminateSessionMessage = `{"terminate_session":true}`;

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

export class RealtimeTranscriber {
  private realtimeUrl: string;
  private sampleRate: number;
  private wordBoost?: string[];
  private encoding?: AudioEncoding;
  private apiKey?: string;
  private token?: string;
  private endUtteranceSilenceThreshold?: number;
  private disablePartialTranscripts?: boolean;

  private socket?: WebSocket;
  private listeners: RealtimeListeners = {};
  private sessionTerminatedResolve?: () => void;

  constructor(params: RealtimeTranscriberParams) {
    this.realtimeUrl = params.realtimeUrl ?? defaultRealtimeUrl;
    this.sampleRate = params.sampleRate ?? 16_000;
    this.wordBoost = params.wordBoost;
    this.encoding = params.encoding;
    this.endUtteranceSilenceThreshold = params.endUtteranceSilenceThreshold;
    this.disablePartialTranscripts = params.disablePartialTranscripts;
    if ("token" in params && params.token) this.token = params.token;
    if ("apiKey" in params && params.apiKey) this.apiKey = params.apiKey;

    if (!(this.token || this.apiKey)) {
      throw new Error("API key or temporary token is required.");
    }
  }

  private connectionUrl(): URL {
    const url = new URL(this.realtimeUrl);

    if (url.protocol !== "wss:") {
      throw new Error("Invalid protocol, must be wss");
    }

    const searchParams = new URLSearchParams();
    if (this.token) {
      searchParams.set("token", this.token);
    }
    searchParams.set("sample_rate", this.sampleRate.toString());
    if (this.wordBoost && this.wordBoost.length > 0) {
      searchParams.set("word_boost", JSON.stringify(this.wordBoost));
    }
    if (this.encoding) {
      searchParams.set("encoding", this.encoding);
    }

    searchParams.set("enable_extra_session_information", "true");

    if (this.disablePartialTranscripts) {
      searchParams.set(
        "disable_partial_transcripts",
        this.disablePartialTranscripts.toString(),
      );
    }
    url.search = searchParams.toString();

    return url;
  }

  on(event: "open", listener: (event: SessionBeginsEventData) => void): void;
  on(
    event: "transcript",
    listener: (transcript: RealtimeTranscript) => void,
  ): void;
  on(
    event: "transcript.partial",
    listener: (transcript: PartialTranscript) => void,
  ): void;
  on(
    event: "transcript.final",
    listener: (transcript: FinalTranscript) => void,
  ): void;
  on(
    event: "session_information",
    listener: (info: SessionInformation) => void,
  ): void;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "close", listener: (code: number, reason: string) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: RealtimeEvents, listener: (...args: any[]) => void) {
    this.listeners[event] = listener;
  }

  connect() {
    return new Promise<SessionBeginsEventData>((resolve) => {
      if (this.socket) {
        throw new Error("Already connected");
      }

      const url = this.connectionUrl();

      if (this.token) {
        this.socket = new WebSocket(url.toString());
      } else {
        this.socket = new WebSocket(url.toString(), {
          headers: { Authorization: this.apiKey },
        });
      }
      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = () => {
        if (
          this.endUtteranceSilenceThreshold === undefined ||
          this.endUtteranceSilenceThreshold === null
        ) {
          return;
        }
        this.configureEndUtteranceSilenceThreshold(
          this.endUtteranceSilenceThreshold,
        );
      };

      this.socket.onclose = ({ code, reason }: CloseEvent) => {
        if (!reason) {
          if (code in RealtimeErrorType) {
            reason = RealtimeErrorMessages[code as RealtimeErrorType];
          }
        }
        this.listeners.close?.(code, reason);
      };

      this.socket.onerror = (event: ErrorEvent) => {
        if (event.error) this.listeners.error?.(event.error as Error);
        else this.listeners.error?.(new Error(event.message));
      };

      this.socket.onmessage = ({ data }: MessageEvent) => {
        const message = JSON.parse(data.toString()) as RealtimeMessage;
        if ("error" in message) {
          this.listeners.error?.(new RealtimeError(message.error));
          return;
        }
        switch (message.message_type) {
          case "SessionBegins": {
            const openObject: SessionBeginsEventData = {
              sessionId: message.session_id,
              expiresAt: new Date(message.expires_at),
            };
            resolve(openObject);
            this.listeners.open?.(openObject);
            break;
          }
          case "PartialTranscript": {
            // message.created is actually a string when coming from the socket
            message.created = new Date(message.created);
            this.listeners.transcript?.(message);
            this.listeners["transcript.partial"]?.(message);
            break;
          }
          case "FinalTranscript": {
            // message.created is actually a string when coming from the socket
            message.created = new Date(message.created);
            this.listeners.transcript?.(message);
            this.listeners["transcript.final"]?.(message);
            break;
          }
          case "SessionInformation": {
            this.listeners.session_information?.(message);
            break;
          }
          case "SessionTerminated": {
            this.sessionTerminatedResolve?.();
            break;
          }
        }
      };
    });
  }

  sendAudio(audio: AudioData) {
    this.send(audio);
  }

  stream(): WritableStream<AudioData> {
    return new WritableStream<AudioData>({
      write: (chunk: AudioData) => {
        this.sendAudio(chunk);
      },
    });
  }

  /**
   * Manually end an utterance
   */
  forceEndUtterance() {
    this.send(forceEndOfUtteranceMessage);
  }

  /**
   * Configure the threshold for how long to wait before ending an utterance. Default is 700ms.
   * @param threshold - The duration of the end utterance silence threshold in milliseconds.
   * This value must be an integer between 0 and 20_000.
   */
  configureEndUtteranceSilenceThreshold(threshold: number) {
    this.send(`{"end_utterance_silence_threshold":${threshold}}`);
  }

  private send(data: BufferLike) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Socket is not open for communication");
    }
    this.socket.send(data);
  }

  async close(waitForSessionTermination = true) {
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
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
      if ("removeAllListeners" in this.socket) this.socket.removeAllListeners();
      this.socket.close();
    }

    this.listeners = {};
    this.socket = undefined;
  }
}

/**
 * @deprecated Use RealtimeTranscriber instead
 */
export class RealtimeService extends RealtimeTranscriber {}
