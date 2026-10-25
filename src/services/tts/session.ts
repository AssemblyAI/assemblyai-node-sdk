import { conditions } from "#conditions";
import {
  factory as polyfillWebSocketFactory,
  PolyfillWebSocket,
} from "#websocket";
import { CloseEvent, ErrorEvent, MessageEvent } from "ws";
import {
  TextToSpeechSessionEvents,
  TextToSpeechSessionListeners,
  TextToSpeechSessionParams,
  TtsAudioEvent,
  TtsBeginEvent,
  TtsCancelledEvent,
  TtsErrorMessage,
  TtsFlushDoneEvent,
  TtsTerminationEvent,
  TtsWordBoundariesEvent,
} from "../..";
import { RETRYABLE_STATUSES, TextToSpeechError } from "../../utils/errors/tts";

const DEFAULT_WEBSOCKET_BASE_URL = "wss://tts.us.assemblyai.com/v1/ws";
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
/**
 * Milliseconds without a message from the API after which `close()` stops
 * waiting: a little over the API's own 30 s drain limit, so the API's 3005
 * Error for a stalled drain normally arrives first.
 */
const DEFAULT_TERMINATE_TIMEOUT_MS = 35_000;
/** Characters one `Generate` frame may carry, unless `Begin` says otherwise. */
const MAX_GENERATE_CHARS = 2000;
/** Audio frames queued for pulling before the oldest is dropped (~160 s). */
const PULL_QUEUE_FRAMES = 2000;
/** Closes after which a new session can succeed. */
const RETRYABLE_CLOSE_CODES = new Set([1006, 1011, 1012, 3005, 3008, 3009]);
/** How the `ws` package reports an upgrade answered with an HTTP status. */
const UPGRADE_STATUS = /Unexpected server response: (\d{3})/;

type PullItem =
  | { kind: "audio"; flushId: number; bytes: Uint8Array }
  | { kind: "done"; flushId: number }
  | { kind: "cancelled"; cancelId: number }
  | { kind: "closed"; error?: TextToSpeechError };

/**
 * One connection: a FIFO that hands items to one waiting reader, and how the
 * connection ended. A reader keeps the connection it started on, so a
 * reconnect cannot change what it sees.
 */
class PullQueue {
  private items: PullItem[] = [];
  private audioItems = 0;
  private waiter?: (item: PullItem) => void;
  dropped = false;
  /** A socket was opened for this connection. */
  hadSocket = false;
  /** The connection is over and its `closed` item is queued. */
  ended = false;
  /** The error the connection ended with, if any. */
  error?: TextToSpeechError;
  /** The API's `Termination` summary, when the connection ended with it. */
  termination?: TtsTerminationEvent;
  /** When the API last sent a message; `close()` starts it at `Terminate`. */
  heardAt = 0;
  /** The connection's one `close()`, which every call shares. */
  closing?: Promise<TtsTerminationEvent | undefined>;
  /** `close()` sent `Terminate`; the API reads no frame after it. */
  terminating = false;
  /** The socket's own close event, when it arrived. */
  closedWith?: [code: number, reason: string];
  closeEmitted = false;
  /** Requests up to this flush id were cancelled. */
  cancelledBefore = -1;
  /** Readers consumed the `FlushDone` of the requests up to this flush id. */
  doneThrough = -1;

  get size() {
    return this.items.length;
  }

  /**
   * The socket's close code and reason; when the socket was released before
   * its close event, the close the API sends after this ending.
   */
  close(): [code: number, reason: string] {
    if (this.closedWith) return this.closedWith;
    const code = this.error?.closeCode ?? 1000;
    if (code !== 1000) return [code, "See Error message for details"];
    return [code, this.termination ? "Session ended" : "Closed by the client"];
  }

  push(item: PullItem) {
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = undefined;
      resolve(item);
      return;
    }
    if (item.kind === "audio") {
      if (this.audioItems >= PULL_QUEUE_FRAMES) {
        // Drop the oldest audio, never a marker, so `audio()` always ends.
        const index = this.items.findIndex((queued) => queued.kind === "audio");
        this.items.splice(index, 1);
        this.audioItems--;
        if (!this.dropped) {
          this.dropped = true;
          console.warn(
            "TextToSpeechSession: dropping audio nobody reads; iterate audio() or add an audio listener",
          );
        }
      }
      this.audioItems++;
    }
    this.items.push(item);
  }

  next(): Promise<PullItem> {
    const item = this.items.shift();
    if (item) {
      if (item.kind === "audio") this.audioItems--;
      return Promise.resolve(item);
    }
    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }
}

/** Pieces of at most `limit` Unicode code points, never split inside a surrogate pair. */
function splitCodePoints(text: string, limit: number): string[] {
  const points = Array.from(text);
  const pieces: string[] = [];
  for (let start = 0; start < points.length; start += limit) {
    pieces.push(points.slice(start, start + limit).join(""));
  }
  return pieces;
}

function codePointLength(text: string): number {
  return Array.from(text).length;
}

/** @throws DOMException for text that is not base64, which makes its frame unreadable. */
function base64ToBytes(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A server frame after `Begin`, read into the event its listener receives. */
type SessionFrame =
  | TtsAudioEvent
  | TtsFlushDoneEvent
  | TtsWordBoundariesEvent
  | TtsCancelledEvent
  | TtsTerminationEvent;

/**
 * The message, text or UTF-8 bytes, as a JSON object; `undefined` for
 * anything else, which carries nothing this SDK reads.
 */
function parseFrame(data: unknown): Record<string, unknown> | undefined {
  if (typeof data !== "string" && !(data instanceof ArrayBuffer)) return;
  const text = typeof data === "string" ? data : new TextDecoder().decode(data);
  let frame: unknown;
  try {
    frame = JSON.parse(text);
  } catch {
    return;
  }
  if (typeof frame !== "object" || frame === null || Array.isArray(frame)) {
    return;
  }
  return frame as Record<string, unknown>;
}

function flushIdOf(frame: Record<string, unknown>): number {
  const flushId = frame.flush_id;
  if (typeof flushId !== "number" || !Number.isInteger(flushId)) {
    throw new TypeError(
      `${String(frame.type)} frame without an integer flush_id`,
    );
  }
  return flushId;
}

/**
 * Checks the fields this SDK reads and decodes the audio; `undefined` for a
 * frame type this SDK does not know.
 * @throws Error for a frame the SDK cannot read.
 */
function readFrame(frame: Record<string, unknown>): SessionFrame | undefined {
  switch (frame.type) {
    case "Audio":
      if (typeof frame.audio !== "string") {
        throw new TypeError("Audio frame without base64 audio");
      }
      return {
        type: "Audio",
        flush_id: flushIdOf(frame),
        audio: base64ToBytes(frame.audio),
      };
    case "FlushDone":
      flushIdOf(frame);
      return frame as unknown as TtsFlushDoneEvent;
    case "WordBoundaries":
    case "Cancelled":
    case "Termination":
      return frame as unknown as SessionFrame;
    default:
      return;
  }
}

function errorFromFrame(frame: TtsErrorMessage): TextToSpeechError {
  return new TextToSpeechError(frame.error || "text-to-speech session failed", {
    errorCode: frame.error_type,
    param: frame.param ?? undefined,
    retryable: frame.retryable,
    retryAfter:
      typeof frame.retry_after_seconds === "number"
        ? Math.ceil(frame.retry_after_seconds)
        : undefined,
    closeCode: frame.error_code,
    body: frame as unknown as Record<string, unknown>,
  });
}

/**
 * The error of a WebSocket that failed before it opened. Node's `ws` names
 * the HTTP status of a refused upgrade in its message; a browser's error
 * event carries no message and no status.
 */
function errorFromHandshake(event: ErrorEvent): TextToSpeechError {
  const message =
    (event.error as Error | undefined)?.message ||
    event.message ||
    "network error or the server refused the upgrade";
  const match = UPGRADE_STATUS.exec(message);
  const status = match ? Number(match[1]) : undefined;
  return new TextToSpeechError(`WebSocket handshake failed: ${message}`, {
    status,
    retryable: status === undefined || RETRYABLE_STATUSES.has(status),
  });
}

function errorFromClose(code: number, reason: string): TextToSpeechError {
  return new TextToSpeechError(
    `Connection closed (code=${code})${reason ? `: ${reason}` : ""}`,
    {
      closeCode: code,
      retryable: RETRYABLE_CLOSE_CODES.has(code),
      body: { close_code: code, reason },
    },
  );
}

/**
 * A Text-to-Speech WebSocket session: text in as it is written, audio out.
 *
 * `connect()` opens the socket and waits for `Begin`. Send text with
 * `generate()` as it is produced, conclude each request with `flush()`, and
 * read its audio with `audio()`; `speak()` does all three for one text.
 * `cancel()` is the barge-in: it stops the request in flight and ends its
 * `audio()` iteration at once. `close()` sends `Terminate` and waits for
 * the session's `Termination` summary.
 *
 * Audio is delivered one of two ways: pulled with `speak()` / `audio()`,
 * one request at a time in order, or pushed to an `audio` listener
 * registered with `on()`. Listeners for the other events (`flushDone`,
 * `wordBoundaries`, `cancelled`, `termination`, `error`, `close`) are
 * optional. A listener that throws is logged with `console.error` and the
 * session goes on. A refusal rejects `connect()`; a failure mid-session
 * rejects the `audio()` iteration or the next send, and a failure nothing
 * observed rejects `close()`. The `error` and `close` listeners run once the
 * connection has ended, so either can `connect()` again; a session opened
 * with a temporary token reconnects with a new one, `connect({ token })`.
 *
 * In a browser, create the session with a temporary token your server
 * minted, `new TextToSpeechSession({ token })`: no client and no API key in
 * the page.
 *
 * @example
 * ```ts
 * const session = client.tts.session({ voiceId: "aai-jane" });
 * await session.connect();
 * for await (const chunk of session.speak("Hello there.")) play(chunk);
 * await session.close();
 * ```
 */
export class TextToSpeechSession {
  private socket?: PolyfillWebSocket;
  private listeners: TextToSpeechSessionListeners = {};
  private queue = new PullQueue();
  private nextFlushId = 0;
  private cancelIds: number[] = [];
  private errorRaised = false;
  private reading = false;
  private terminationResolve?: () => void;
  private abortConnect?: (error: TextToSpeechError) => void;

  /** The `Begin` frame, once connected. */
  begin?: TtsBeginEvent;
  /** The `Termination` summary once the session ended cleanly. */
  termination?: TtsTerminationEvent;
  /** The error that ended the session, if one did. */
  error?: TextToSpeechError;

  /** The temporary token of the next connection; `connect({ token })` replaces it. */
  private token?: string;

  /** @throws Error if neither `apiKey` nor `token` is given. */
  constructor(private readonly params: TextToSpeechSessionParams) {
    if (!params.token && !params.apiKey) {
      throw new Error("API key or temporary token is required.");
    }
    this.token = params.token;
  }

  /** The current connection is over: sends refuse and readers drain. */
  private get stopped(): boolean {
    return this.queue.ended;
  }

  on(event: "begin", listener: (event: TtsBeginEvent) => void): void;
  on(event: "audio", listener: (event: TtsAudioEvent) => void): void;
  on(event: "flushDone", listener: (event: TtsFlushDoneEvent) => void): void;
  on(
    event: "wordBoundaries",
    listener: (event: TtsWordBoundariesEvent) => void,
  ): void;
  on(event: "cancelled", listener: (event: TtsCancelledEvent) => void): void;
  on(
    event: "termination",
    listener: (event: TtsTerminationEvent) => void,
  ): void;
  on(event: "error", listener: (error: TextToSpeechError) => void): void;
  on(event: "close", listener: (code: number, reason: string) => void): void;
  /** Registers the listener of a server frame type; one listener per event. */
  on(event: TextToSpeechSessionEvents, listener: (...args: never[]) => void) {
    (this.listeners as Record<string, unknown>)[event] = listener;
  }

  /** @throws Error if `websocketBaseUrl` is not a ws:// or wss:// URL. */
  private baseUrl(): URL {
    const url = new URL(
      this.params.websocketBaseUrl ?? DEFAULT_WEBSOCKET_BASE_URL,
    );
    if (url.protocol !== "wss:" && url.protocol !== "ws:") {
      throw new Error(
        "The WebSocket base URL must use the wss:// or ws:// protocol",
      );
    }
    return url;
  }

  /** `url` with the session's parameters and token in its query. */
  private connectionUrl(url: URL): URL {
    const p = this.params;
    const set = (name: string, value: unknown) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(name, String(value));
      }
    };
    set("voice_id", p.voiceId);
    set("model_id", p.modelId);
    set("language", p.language);
    set("sample_rate", p.sampleRate);
    set("encoding", p.encoding);
    set("word_boundaries", p.wordBoundaries ?? false);
    set("inactivity_timeout", p.inactivityTimeout);
    set("extend_biometric_consent", p.extendBiometricConsent);
    set("token", this.token);
    return url;
  }

  private reset() {
    this.queue = new PullQueue();
    this.nextFlushId = 0;
    this.cancelIds = [];
    this.errorRaised = false;
    this.reading = false;
    this.begin = undefined;
    this.termination = undefined;
    this.error = undefined;
  }

  /**
   * Opens the socket and waits for `Begin`.
   *
   * A session the API has ended can be connected again with the same object.
   * A temporary token opens one connection, so a session opened with a token
   * needs a new one for each connection, reconnects included: mint it on
   * your server and pass it here. The API may refuse a token it has already
   * seen, and always refuses an expired one, with close code 1008
   * (`errorCode: "unauthorized"`, not retryable).
   * @param options.token - A new temporary token. It replaces the session's
   * token for this connection and the next ones, and is sent instead of the
   * API key.
   * @throws TextToSpeechError if the API refuses the session, the handshake
   * fails, the socket cannot be opened, or `Begin` does not arrive in time.
   * `status` is set when the API or a proxy answered the upgrade with an
   * HTTP status the runtime reports.
   * @throws Error, before anything else changes, if `websocketBaseUrl` is
   * not a ws:// or wss:// URL.
   */
  connect(options: { token?: string } = {}): Promise<TtsBeginEvent> {
    let base: URL;
    try {
      base = this.baseUrl();
    } catch (error) {
      return Promise.reject(error);
    }
    if (this.stopped) {
      // The previous connection's close, when its socket was released before
      // the close event arrived. The close listener may connect again.
      this.releaseSocket();
      this.emitClose(this.queue);
    }
    if (this.socket && !this.stopped) {
      return Promise.reject(new Error("The session is already connected"));
    }
    if (options.token) this.token = options.token;
    const token = this.token;
    this.releaseSocket();
    this.reset();
    const connection = this.queue;
    const url = this.connectionUrl(base);
    const timeoutMs = this.params.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT_MS;

    return new Promise<TtsBeginEvent>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settle(() => {
          this.error = new TextToSpeechError(
            `The session did not begin within ${timeoutMs}ms`,
            { retryable: true },
          );
          this.end();
          this.releaseSocket();
          reject(this.surfaced());
        });
        this.emitClose(connection);
      }, timeoutMs);
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.abortConnect = undefined;
        fn();
      };
      this.abortConnect = (error) => settle(() => reject(error));
      // Ends the connection and settles connect() before the error listener
      // runs, so the listener sees an ended session it can connect again.
      const fail = (error: TextToSpeechError) => {
        const raised = this.fail(error);
        settle(() => reject(this.surfaced()));
        if (raised) this.emit("error", raised);
      };
      // A frame the SDK cannot read fails the session, and closing the socket
      // stops the API from synthesizing for it. The socket is released before
      // the error listener runs, which may connect again.
      const unreadable = (cause: unknown) => {
        const raised = this.fail(
          new TextToSpeechError(
            `Unreadable frame from the API: ${String(cause)}`,
          ),
        );
        this.releaseSocket();
        settle(() => reject(this.surfaced()));
        if (raised) this.emit("error", raised);
        this.emitClose(connection);
      };

      if (!token && conditions.browser) {
        console.warn(
          `API key authentication is not supported for the TextToSpeechSession in browser environments. Use temporary token authentication instead.
Learn more at https://github.com/AssemblyAI/assemblyai-node-sdk/blob/main/docs/compat.md#browser-compatibility.`,
        );
      }
      let socket: PolyfillWebSocket;
      try {
        socket = token
          ? // The token alone: an Authorization header would override it.
            polyfillWebSocketFactory(url.toString())
          : polyfillWebSocketFactory(url.toString(), {
              headers: { Authorization: this.params.apiKey },
            });
      } catch (cause) {
        // The runtime refused to create the socket (a browser's WebSocket
        // takes no headers, for one), so there is no connection to close.
        this.error = new TextToSpeechError(
          `Could not open the WebSocket: ${cause instanceof Error ? cause.message : String(cause)}`,
          { retryable: false },
        );
        this.end();
        settle(() => reject(this.surfaced()));
        return;
      }
      this.socket = socket;
      connection.hadSocket = true;
      socket.binaryType = "arraybuffer";
      socket.onopen = () => {};

      socket.onmessage = ({ data }: MessageEvent) => {
        connection.heardAt = Date.now();
        const frame = parseFrame(data);
        if (!frame) return;
        if (frame.type === "Begin") {
          const begin = frame as unknown as TtsBeginEvent;
          this.begin = begin;
          settle(() => resolve(begin));
          this.emit("begin", begin);
          return;
        }
        if (frame.type === "Error") {
          fail(errorFromFrame(frame as unknown as TtsErrorMessage));
          return;
        }
        let event: SessionFrame | undefined;
        try {
          event = readFrame(frame);
        } catch (cause) {
          unreadable(cause);
          return;
        }
        if (event) this.dispatch(event);
      };

      socket.onclose = ({ code, reason }: CloseEvent) => {
        const text = typeof reason === "string" ? reason : "";
        connection.closedWith = [code, text];
        let raised: TextToSpeechError | undefined;
        if (!this.stopped && code !== 1000 && !this.error) {
          raised = this.error = errorFromClose(code, text);
          if (this.begin) raised.requestId = this.begin.id;
        }
        this.end();
        settle(() =>
          reject(this.error ? this.surfaced() : errorFromClose(code, text)),
        );
        if (raised) this.emit("error", raised);
        this.emitClose(connection);
      };

      socket.onerror = (event: ErrorEvent) => {
        if (settled) return; // after Begin, the close that follows reports it
        this.error = errorFromHandshake(event);
        this.end();
        settle(() => reject(this.surfaced()));
      };
    });
  }

  /** Applies a frame to the session's state, then calls its listener. */
  private dispatch(event: SessionFrame) {
    switch (event.type) {
      case "Audio":
        if (this.listeners.audio) this.emit("audio", event);
        else {
          this.enqueue({
            kind: "audio",
            flushId: event.flush_id,
            bytes: event.audio,
          });
        }
        return;
      case "FlushDone":
        this.enqueue({ kind: "done", flushId: event.flush_id });
        this.emit("flushDone", event);
        return;
      case "WordBoundaries":
        this.emit("wordBoundaries", event);
        return;
      case "Cancelled": {
        const cancelId = this.cancelIds.shift() ?? -1;
        this.enqueue({ kind: "cancelled", cancelId });
        this.emit("cancelled", event);
        return;
      }
      case "Termination":
        this.termination = event;
        this.end();
        this.emit("termination", event);
        return;
    }
  }

  /**
   * Calls the listener of `event`. A listener that throws is logged and the
   * session goes on: an error in the app never fails the session.
   */
  private emit<E extends TextToSpeechSessionEvents>(
    event: E,
    ...args: Parameters<NonNullable<TextToSpeechSessionListeners[E]>>
  ) {
    const listener = this.listeners[event] as
      | ((
          ...args: Parameters<NonNullable<TextToSpeechSessionListeners[E]>>
        ) => void)
      | undefined;
    try {
      listener?.(...args);
    } catch (error) {
      console.error(`TextToSpeechSession: the ${event} listener threw`, error);
    }
  }

  /**
   * Ends the connection with `error`; returns it when it is the session's
   * first error, for the caller to pass to the error listener.
   */
  private fail(error: TextToSpeechError): TextToSpeechError | undefined {
    if (this.error) return undefined; // the connection already ended with it
    if (!error.requestId && this.begin) error.requestId = this.begin.id;
    this.error = error;
    this.end();
    return error;
  }

  /**
   * Queues an item for `audio()`. While an `audio` listener receives the
   * frames, audio is never queued, and markers are queued only for an
   * `audio()` iteration already running, so it still ends.
   */
  private enqueue(item: PullItem) {
    if (this.listeners.audio && (item.kind === "audio" || !this.reading)) {
      return;
    }
    this.queue.push(item);
  }

  /** Reports a connection's close to the close listener, once. */
  private emitClose(connection: PullQueue) {
    if (!connection.hadSocket || connection.closeEmitted) return;
    connection.closeEmitted = true;
    const [code, reason] = connection.close();
    this.emit("close", code, reason);
  }

  /**
   * Marks the connection over: readers drain, sends refuse. It ends with the
   * session's error, else with `cut`, the audio a `close()` stopped waiting for.
   */
  private end(cut?: TextToSpeechError) {
    const connection = this.queue;
    if (connection.ended) return;
    connection.ended = true;
    connection.error = this.error ?? cut;
    connection.termination = this.termination;
    this.enqueue({ kind: "closed", error: connection.error });
    this.terminationResolve?.();
    this.terminationResolve = undefined;
  }

  private releaseSocket() {
    const socket = this.socket;
    this.socket = undefined;
    if (!socket) return;
    socket.removeAllListeners?.();
    socket.onerror = () => {};
    socket.onclose = () => {};
    socket.onmessage = () => {};
    try {
      socket.close();
    } catch {
      // already closed
    }
  }

  /** Marks `error` observed when it is the session's own error, and returns it. */
  private surface(error: TextToSpeechError): TextToSpeechError {
    if (error === this.error) this.errorRaised = true;
    return error;
  }

  private surfaced(): TextToSpeechError {
    return this.surface(this.error as TextToSpeechError);
  }

  /** `close()` sent `Terminate` and the connection has not ended yet. */
  private get terminating(): boolean {
    return this.queue.terminating && !this.stopped;
  }

  /**
   * @throws Error once `close()` has sent `Terminate`, since the API reads
   * no frame after it, and when the session is not connected.
   * @throws TextToSpeechError the error that ended the session; or, while
   * the socket is closing and its close event has not run yet, a retryable
   * one: a close without an `Error` frame, such as 1006 or 1011.
   */
  private send(frame: Record<string, unknown>) {
    const socket = this.socket;
    if (this.terminating) {
      throw new Error("The session is closing: close() was called");
    }
    if (socket && !this.stopped && socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(frame));
      return;
    }
    if (this.error) throw this.surfaced();
    if (socket && this.begin && !this.stopped) {
      throw new TextToSpeechError("The connection is closing", {
        retryable: true,
        requestId: this.begin.id,
      });
    }
    throw new Error("The session is not open: call connect() first");
  }

  private limits(): Record<string, unknown> | undefined {
    return this.begin?.configuration?.limits as
      | Record<string, unknown>
      | undefined;
  }

  private generateLimit(): number {
    const limit = this.limits()?.max_generate_text_length;
    return typeof limit === "number" && limit >= 0 ? limit : MAX_GENERATE_CHARS;
  }

  /**
   * The unspoken characters the API holds before it ends the session with
   * 3010, as `Begin` reports it; `0` for no limit.
   */
  private backlogLimit(): number {
    const limits = this.limits();
    if (limits?.text_throttle_enabled === false) return 0;
    const limit = limits?.text_max_buffer_chars;
    return typeof limit === "number" && limit > 0 ? limit : 0;
  }

  private checkPullable() {
    if (this.listeners.audio) {
      throw new Error(
        "audio goes to the registered audio listener; pull with audio() or speak() only without one",
      );
    }
    if (this.reading) {
      throw new Error(
        "one audio() iteration at a time: requests are served in order, so read them in order",
      );
    }
  }

  /**
   * Appends `text` to the current request.
   *
   * Consecutive texts are joined exactly as sent, so include the spaces.
   * Audio may start before `flush()` once enough complete sentences have
   * arrived; `flush()` is what concludes the request.
   * @throws RangeError for a text over one frame's limit (2,000 characters); split it.
   * @throws Error once `close()` was called: the API would not read the text.
   */
  generate(text: string) {
    if (typeof text !== "string") throw new TypeError("text must be a string");
    const limit = this.generateLimit();
    const length = codePointLength(text);
    if (limit && length > limit) {
      throw new RangeError(
        `text is ${length} characters, over the ${limit}-character limit of one Generate frame; split it across several generate() calls`,
      );
    }
    this.send({ type: "Generate", text });
  }

  /**
   * Concludes the current request and returns its `flush_id`.
   *
   * Everything sent so far is spoken, then `FlushDone` arrives for this id.
   * Flushes can be pipelined; the audio comes in order.
   */
  flush(): number {
    this.send({ type: "Flush" });
    return this.nextFlushId++;
  }

  /**
   * Barge-in: stops the request in flight and drops queued requests.
   *
   * An `audio()` iteration of a cancelled request, or of the text being
   * written, ends at once; audio of it still in transit is discarded. Like
   * `flush()`, a cancel takes a `flush_id`, so the next request's id skips one.
   * A cancel the session refuses (after `close()`, or once the connection
   * is lost) changes nothing: the iterations go on to their own end.
   */
  cancel() {
    this.send({ type: "Cancel" });
    const cancelId = this.nextFlushId++;
    this.cancelIds.push(cancelId);
    this.queue.cancelledBefore = Math.max(this.queue.cancelledBefore, cancelId);
  }

  /**
   * Resets the inactivity timer between sparse requests. Once `close()` was
   * called it does nothing, so a keepalive timer still running while the
   * session drains does not throw.
   */
  keepAlive() {
    if (this.terminating) return;
    this.send({ type: "KeepAlive" });
  }

  /**
   * Speaks one text: `generate()`, `flush()`, then its audio.
   *
   * Text longer than one frame is split across frames, sent at once. The
   * API holds a limited backlog of text it has not spoken yet (`Begin`'s
   * `limits.text_max_buffer_chars`, 8,000 characters by default) and ends
   * the session with a non-retryable 3010 when a burst passes it, so longer
   * text is refused before anything is sent. The backlog counts all the
   * session's unspoken text, so this check prevents a sure 3010 without
   * guaranteeing success: split long text and `speak()` each part once the
   * previous part's audio is read, or pace it with `generate()`. Returns an
   * async iterable of the request's audio that ends at its `FlushDone`, or
   * early if the request is cancelled.
   * @throws RangeError for text over the backlog limit.
   */
  speak(text: string): AsyncIterable<Uint8Array> {
    if (typeof text !== "string") throw new TypeError("text must be a string");
    this.checkPullable();
    const length = codePointLength(text);
    const backlog = this.backlogLimit();
    if (backlog && length > backlog) {
      throw new RangeError(
        `text is ${length} characters, over the ${backlog} unspoken characters the API holds before it ends the session with 3010 input_rate_exceeded; split it and speak() each part once the previous part's audio is read, or pace it with generate()`,
      );
    }
    const limit = this.generateLimit() || Math.max(length, 1);
    for (const piece of splitCodePoints(text, limit)) this.generate(piece);
    return this.audio(this.flush());
  }

  /**
   * The audio of request `flushId`: an async iterator that ends at its
   * `FlushDone`, or early if the request is cancelled.
   *
   * The request is fixed when `audio()` is called, not when it is first
   * iterated. Without `flushId` it is the request being written now, whose
   * id the next `flush()` returns, so the iterator can be made before the
   * first `generate()` and read while text is still being sent. Requests
   * are served in order, so read each one once, in order, one iteration at
   * a time. Audio is queued for pulling only while no `audio` listener is
   * registered. The iteration rejects with a `TextToSpeechError` if the
   * session fails before the request completes.
   * @throws Error if the session was never connected.
   * @throws RangeError for a request not flushed yet, or one already read
   * (its `FlushDone` was consumed by an earlier iteration).
   */
  audio(flushId?: number): AsyncGenerator<Uint8Array, void, undefined> {
    // The connection this request is sent on.
    const connection = this.queue;
    if (!connection.hadSocket) {
      throw new Error("The session is not open: call connect() first");
    }
    const id = flushId ?? this.nextFlushId;
    if (id > this.nextFlushId) {
      throw new RangeError(`flush_id ${id} has not been flushed yet`);
    }
    this.checkUnread(connection, id);
    return this.readAudio(connection, id);
  }

  private checkUnread(connection: PullQueue, flushId: number) {
    if (flushId <= connection.doneThrough) {
      throw new RangeError(
        `flush_id ${flushId} was already read: read each request once, in order`,
      );
    }
  }

  /** Reads request `flushId` from `connection`, until its end. */
  private async *readAudio(
    connection: PullQueue,
    flushId: number,
  ): AsyncGenerator<Uint8Array, void, undefined> {
    // After a reconnect the reader stays on its own connection, which drains
    // to its `closed` item, and leaves the new connection's readers alone.
    const current = this.queue === connection;
    if (current) {
      this.checkPullable();
      // Another iterator may have read past this request since audio().
      this.checkUnread(connection, flushId);
      this.reading = true;
    }
    try {
      for (;;) {
        // A Cancel drops every request before it and the text being written,
        // whose id it takes.
        if (flushId <= connection.cancelledBefore) return;
        if (connection.ended && connection.size === 0) {
          if (connection.error) throw this.surface(connection.error);
          return;
        }
        const item = await connection.next();
        switch (item.kind) {
          case "audio":
            if (item.flushId === flushId) yield item.bytes;
            break;
          case "done":
            // Counted when read, so a FlushDone still queued for a pipelined
            // request leaves it readable.
            connection.doneThrough = Math.max(
              connection.doneThrough,
              item.flushId,
            );
            if (item.flushId === flushId) return;
            break;
          case "cancelled":
            if (item.cancelId >= flushId) return;
            break;
          case "closed":
            if (item.error) throw this.surface(item.error);
            return;
        }
      }
    } finally {
      if (current && this.queue === connection) this.reading = false;
    }
  }

  /**
   * Ends the session: `Terminate`, then the `Termination` summary.
   *
   * Text sent and not flushed is spoken first, and the wait lasts as long as
   * the API keeps sending: it stops after `terminateTimeout` milliseconds
   * without a message from the API. Then the socket is closed, the API drops
   * the audio still to come, and an `audio()` iteration still running
   * rejects with a retryable `TextToSpeechError`. Resolves with the summary,
   * or `undefined` if the session had already ended or the wait stopped. A
   * `connect()` still pending is rejected. All calls on one connection share
   * one close: one `Terminate` is sent, and every call resolves when the
   * connection ends; the arguments of the first call apply.
   * @param waitForTermination - Wait for the summary before closing the socket.
   * @param terminateTimeout - Milliseconds without a message from the API
   * after which the wait stops; `0` waits indefinitely. Defaults to the
   * session's `terminateTimeout`, else 35 000.
   * @throws TextToSpeechError the session's error, when nothing else surfaced
   * it; only the first call throws it.
   */
  close(
    waitForTermination = true,
    terminateTimeout = this.params.terminateTimeout ??
      DEFAULT_TERMINATE_TIMEOUT_MS,
  ): Promise<TtsTerminationEvent | undefined> {
    const connection = this.queue;
    if (connection.closing) {
      // The first call is the one that throws the session's error.
      return connection.closing.catch(() => connection.termination);
    }
    connection.closing = this.closeConnection(
      connection,
      waitForTermination,
      terminateTimeout,
    );
    return connection.closing;
  }

  private async closeConnection(
    connection: PullQueue,
    waitForTermination: boolean,
    terminateTimeout: number,
  ): Promise<TtsTerminationEvent | undefined> {
    const socket = this.socket;
    this.abortConnect?.(
      new TextToSpeechError("The session was closed before it began"),
    );
    if (socket && !this.stopped && socket.readyState === socket.OPEN) {
      const ended = new Promise<void>((resolve) => {
        this.terminationResolve = resolve;
      });
      connection.heardAt = Date.now();
      connection.terminating = true;
      try {
        socket.send(JSON.stringify({ type: "Terminate" }));
      } catch {
        // the socket closed under us; the close handler ends the session
      }
      if (
        waitForTermination &&
        !(await this.drained(connection, ended, terminateTimeout)) &&
        this.queue === connection
      ) {
        this.end(
          new TextToSpeechError(
            "No Termination within the terminate timeout; the remaining audio was dropped",
            { retryable: true, requestId: this.begin?.id },
          ),
        );
      }
    }
    if (this.queue !== connection) {
      // A listener connected again while this close waited; the new
      // connection is not this close's to end.
      return connection.termination;
    }
    this.end();
    this.releaseSocket();
    const termination = this.termination;
    const unobserved =
      this.error && !this.errorRaised ? this.surfaced() : undefined;
    // Reported last: the close listener may connect again.
    this.emitClose(connection);
    if (unobserved) throw unobserved;
    return termination;
  }

  /**
   * Resolves `true` when `ended` does, or `false` once the API has sent
   * nothing for `idleMs` milliseconds; `0` waits indefinitely.
   */
  private drained(
    connection: PullQueue,
    ended: Promise<void>,
    idleMs: number,
  ): Promise<boolean> {
    const done = ended.then(() => true);
    if (!(idleMs > 0)) return done;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const idle = new Promise<boolean>((resolve) => {
      const check = () => {
        const quiet = Date.now() - connection.heardAt;
        if (quiet >= idleMs) resolve(false);
        else timer = setTimeout(check, idleMs - quiet);
      };
      timer = setTimeout(check, idleMs);
    });
    return Promise.race([done, idle]).finally(() => clearTimeout(timer));
  }
}
