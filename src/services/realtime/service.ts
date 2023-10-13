import WebSocket from "ws";
import {
  RealtimeEvents,
  RealtimeListeners,
  RealtimeServiceParams,
  RealtimeMessage,
  RealtimeTranscript,
  PartialTranscript,
  FinalTranscript,
  SessionBeginsEventData,
} from "@/types";
import {
  RealtimeError,
  RealtimeErrorMessages,
  RealtimeErrorType,
} from "@/utils/errors";
import { Writable } from "stream";

const defaultRealtimeUrl = "wss://api.assemblyai.com/v2/realtime/ws";

export class RealtimeService {
  private realtimeUrl: string;
  private sampleRate: number;
  private wordBoost?: string[];
  private apiKey?: string;
  private token?: string;
  private socket?: WebSocket;
  private listeners: RealtimeListeners = {};
  private sessionTerminatedResolve?: () => void;

  constructor(params: RealtimeServiceParams) {
    this.realtimeUrl = params.realtimeUrl ?? defaultRealtimeUrl;
    this.sampleRate = params.sampleRate ?? 16_000;
    this.wordBoost = params.wordBoost;
    this.realtimeUrl = params.realtimeUrl ?? defaultRealtimeUrl;
    if ("apiKey" in params) this.apiKey = params.apiKey;
    if ("token" in params) this.token = params.token;

    if (!(this.apiKey || this.token)) {
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
    url.search = searchParams.toString();

    return url;
  }

  on(event: "open", listener: (event: SessionBeginsEventData) => void): void;
  on(
    event: "transcript",
    listener: (transcript: RealtimeTranscript) => void
  ): void;
  on(
    event: "transcript.partial",
    listener: (transcript: PartialTranscript) => void
  ): void;
  on(
    event: "transcript.final",
    listener: (transcript: FinalTranscript) => void
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

      let headers;
      if (this.token) {
        headers = undefined;
      } else if (this.apiKey) {
        headers = { Authorization: this.apiKey };
      }

      this.socket = new WebSocket(url.toString(), { headers });

      this.socket.onclose = ({ code, reason }: WebSocket.CloseEvent) => {
        if (!reason) {
          if (code in RealtimeErrorType) {
            reason = RealtimeErrorMessages[code as RealtimeErrorType];
          }
        }
        this.listeners.close?.(code, reason);
      };

      this.socket.onerror = (errorEvent: WebSocket.ErrorEvent) => {
        if (errorEvent.error) this.listeners.error?.(errorEvent.error as Error);
        else this.listeners.error?.(new Error(errorEvent.message));
      };

      this.socket.onmessage = ({ data }: WebSocket.MessageEvent) => {
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
          case "SessionTerminated": {
            this.sessionTerminatedResolve?.();
            break;
          }
        }
      };
    });
  }

  sendAudio(audio: ArrayBuffer) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Socket is not open for communication");
    }

    const payload = {
      audio_data: Buffer.from(audio).toString("base64"),
    };
    this.socket.send(JSON.stringify(payload));
  }

  stream(): Writable {
    const stream = new Writable({
      write: (chunk: Buffer, encoding, next) => {
        this.sendAudio(chunk);
        next();
      },
    });
    return stream;
  }

  async close(waitForSessionTermination = true) {
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        const terminateSessionMessage = `{"terminate_session": true}`;
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
      this.socket.removeAllListeners();
      this.socket.close();
    }

    this.listeners = {};
    this.socket = undefined;
  }
}
