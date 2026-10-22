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
import { TextToSpeechError } from "../../utils/errors/tts";

const DEFAULT_WEBSOCKET_BASE_URL = "wss://tts.us.assemblyai.com/v1/ws";
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_TERMINATE_TIMEOUT_MS = 10_000;
/** Characters one `Generate` frame may carry, unless `Begin` says otherwise. */
const MAX_GENERATE_CHARS = 2000;
/** Audio frames queued for pulling before the oldest is dropped (~160 s). */
const PULL_QUEUE_FRAMES = 2000;
/** Closes after which a new session can succeed. */
const RETRYABLE_CLOSE_CODES = new Set([1006, 1011, 1012, 3005, 3008, 3009]);

type PullItem =
  | { kind: "audio"; flushId: number; bytes: Uint8Array }
  | { kind: "done"; flushId: number }
  | { kind: "cancelled"; cancelId: number }
  | { kind: "error"; error: TextToSpeechError }
  | { kind: "closed" };

/** A FIFO that hands items to one waiting reader; one per connection. */
class PullQueue {
  private items: PullItem[] = [];
  private audioItems = 0;
  private waiter?: (item: PullItem) => void;
  dropped = false;

  get size() {
    return this.items.length;
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

function base64ToBytes(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
 * optional. A refusal rejects `connect()`; a failure mid-session rejects the
 * `audio()` iteration or the next send, and a failure nothing observed
 * rejects `close()`.
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
  private cancelledBefore = -1;
  private stopped = false;
  private errorRaised = false;
  private reading = false;
  private closeEmitted = false;
  private terminationResolve?: () => void;
  private abortConnect?: (error: TextToSpeechError) => void;

  /** The `Begin` frame, once connected. */
  begin?: TtsBeginEvent;
  /** The `Termination` summary once the session ended cleanly. */
  termination?: TtsTerminationEvent;
  /** The error that ended the session, if one did. */
  error?: TextToSpeechError;

  constructor(private readonly params: TextToSpeechSessionParams) {}

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

  private connectionUrl(): URL {
    const url = new URL(
      this.params.websocketBaseUrl ?? DEFAULT_WEBSOCKET_BASE_URL,
    );
    if (url.protocol !== "wss:" && url.protocol !== "ws:") {
      throw new Error(
        "The WebSocket base URL must use the wss:// or ws:// protocol",
      );
    }
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
    set("token", p.token);
    return url;
  }

  private reset() {
    this.queue = new PullQueue();
    this.nextFlushId = 0;
    this.cancelIds = [];
    this.cancelledBefore = -1;
    this.stopped = false;
    this.errorRaised = false;
    this.reading = false;
    this.closeEmitted = false;
    this.begin = undefined;
    this.termination = undefined;
    this.error = undefined;
  }

  /**
   * Opens the socket and waits for `Begin`.
   *
   * A session the API has ended can be connected again with the same object.
   * @throws TextToSpeechError if the API refuses the session, the handshake
   * fails, or `Begin` does not arrive in time.
   */
  connect(): Promise<TtsBeginEvent> {
    if (this.socket && !this.stopped) {
      return Promise.reject(new Error("The session is already connected"));
    }
    this.releaseSocket();
    this.reset();
    const url = this.connectionUrl();
    const timeoutMs = this.params.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT_MS;

    return new Promise<TtsBeginEvent>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settle(() => {
          this.releaseSocket();
          this.stopped = true;
          reject(
            new TextToSpeechError(
              `The session did not begin within ${timeoutMs}ms`,
              { retryable: true },
            ),
          );
        });
      }, timeoutMs);
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.abortConnect = undefined;
        fn();
      };
      this.abortConnect = (error) => settle(() => reject(error));

      if (this.params.token) {
        this.socket = polyfillWebSocketFactory(url.toString());
      } else {
        if (conditions.browser) {
          console.warn(
            `API key authentication is not supported for the TextToSpeechSession in browser environments. Use temporary token authentication instead.
Learn more at https://github.com/AssemblyAI/assemblyai-node-sdk/blob/main/docs/compat.md#browser-compatibility.`,
          );
        }
        this.socket = polyfillWebSocketFactory(url.toString(), {
          headers: { Authorization: this.params.apiKey },
        });
      }
      const socket = this.socket;
      socket.binaryType = "arraybuffer";
      socket.onopen = () => {};

      socket.onmessage = ({ data }: MessageEvent) => {
        if (typeof data !== "string" && !(data instanceof ArrayBuffer)) return;
        const text =
          typeof data === "string" ? data : new TextDecoder().decode(data);
        let frame: Record<string, unknown>;
        try {
          frame = JSON.parse(text) as Record<string, unknown>;
        } catch {
          return;
        }
        if (frame.type === "Begin") {
          this.begin = frame as unknown as TtsBeginEvent;
          this.listeners.begin?.(this.begin);
          settle(() => resolve(this.begin as TtsBeginEvent));
          return;
        }
        if (frame.type === "Error") {
          const error = errorFromFrame(frame as unknown as TtsErrorMessage);
          this.fail(error);
          settle(() => reject(error));
          return;
        }
        try {
          this.dispatch(frame);
        } catch (cause) {
          const error = new TextToSpeechError(
            `Unreadable frame from the API: ${String(cause)}`,
          );
          this.fail(error);
          settle(() => reject(error));
        }
      };

      socket.onclose = ({ code, reason }: CloseEvent) => {
        const text = typeof reason === "string" ? reason : "";
        if (!this.stopped && code !== 1000 && !this.error) {
          this.error = errorFromClose(code, text);
          if (this.begin) this.error.requestId = this.begin.id;
          this.listeners.error?.(this.error);
        }
        this.end();
        this.emitClose(code, text);
        settle(() => reject(this.error ?? errorFromClose(code, text)));
      };

      socket.onerror = (event: ErrorEvent) => {
        if (settled) return; // after Begin, the close that follows reports it
        const message =
          (event.error as Error | undefined)?.message ?? event.message;
        const error = new TextToSpeechError(
          `WebSocket handshake failed: ${message}`,
          { retryable: true },
        );
        this.error = error;
        this.end();
        settle(() => reject(error));
      };
    });
  }

  private dispatch(frame: Record<string, unknown>) {
    switch (frame.type) {
      case "Audio": {
        const event: TtsAudioEvent = {
          type: "Audio",
          flush_id: frame.flush_id as number,
          audio: base64ToBytes(frame.audio as string),
        };
        if (this.listeners.audio) this.listeners.audio(event);
        else {
          this.enqueue({
            kind: "audio",
            flushId: event.flush_id,
            bytes: event.audio,
          });
        }
        return;
      }
      case "FlushDone": {
        const event = frame as unknown as TtsFlushDoneEvent;
        this.enqueue({ kind: "done", flushId: event.flush_id });
        this.listeners.flushDone?.(event);
        return;
      }
      case "WordBoundaries":
        this.listeners.wordBoundaries?.(
          frame as unknown as TtsWordBoundariesEvent,
        );
        return;
      case "Cancelled": {
        const cancelId = this.cancelIds.shift() ?? -1;
        this.enqueue({ kind: "cancelled", cancelId });
        this.listeners.cancelled?.(frame as unknown as TtsCancelledEvent);
        return;
      }
      case "Termination":
        this.termination = frame as unknown as TtsTerminationEvent;
        this.listeners.termination?.(this.termination);
        this.end();
        return;
      default:
        return; // a frame type this SDK does not know
    }
  }

  private fail(error: TextToSpeechError) {
    if (!this.error) {
      if (!error.requestId && this.begin) error.requestId = this.begin.id;
      this.error = error;
      this.listeners.error?.(error);
    }
    this.enqueue({ kind: "error", error: this.error });
    this.end();
  }

  /** Queues an item for `audio()`; nothing is queued while an `audio` listener receives the frames. */
  private enqueue(item: PullItem) {
    if (this.listeners.audio) return;
    this.queue.push(item);
  }

  private emitClose(code: number, reason: string) {
    if (this.closeEmitted) return;
    this.closeEmitted = true;
    this.listeners.close?.(code, reason);
  }

  /** Marks the connection over: waiters wake up, sends refuse. */
  private end() {
    if (this.stopped) return;
    this.stopped = true;
    this.enqueue({ kind: "closed" });
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

  private surfaced(): TextToSpeechError {
    this.errorRaised = true;
    return this.error as TextToSpeechError;
  }

  private send(frame: Record<string, unknown>) {
    if (
      !this.socket ||
      this.stopped ||
      this.socket.readyState !== this.socket.OPEN
    ) {
      if (this.error) throw this.surfaced();
      throw new Error("The session is not open: call connect() first");
    }
    this.socket.send(JSON.stringify(frame));
  }

  private generateLimit(): number {
    const limits = this.begin?.configuration?.limits as
      | Record<string, unknown>
      | undefined;
    const limit = limits?.max_generate_text_length;
    return typeof limit === "number" && limit >= 0 ? limit : MAX_GENERATE_CHARS;
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
    const flushId = this.nextFlushId++;
    this.send({ type: "Flush" });
    return flushId;
  }

  /**
   * Barge-in: stops the request in flight and drops queued requests.
   *
   * An `audio()` iteration of a cancelled request, or of the text being
   * written, ends at once; audio of it still in transit is discarded. Like
   * `flush()`, a cancel takes a `flush_id`, so the next request's id skips one.
   */
  cancel() {
    const cancelId = this.nextFlushId++;
    this.cancelIds.push(cancelId);
    this.cancelledBefore = Math.max(this.cancelledBefore, cancelId);
    this.send({ type: "Cancel" });
  }

  /** Resets the inactivity timer between sparse requests. */
  keepAlive() {
    this.send({ type: "KeepAlive" });
  }

  /**
   * Speaks one text: `generate()`, `flush()`, then its audio.
   *
   * Text longer than one frame is split across frames. Returns an async
   * iterable of the request's audio that ends at its `FlushDone`, or early
   * if the request is cancelled.
   */
  speak(text: string): AsyncIterable<Uint8Array> {
    if (typeof text !== "string") throw new TypeError("text must be a string");
    this.checkPullable();
    const limit = this.generateLimit() || Math.max(codePointLength(text), 1);
    for (const piece of splitCodePoints(text, limit)) this.generate(piece);
    return this.audio(this.flush());
  }

  /**
   * Yields the audio of request `flushId` until its `FlushDone`.
   *
   * Without `flushId`, the request being written now, so audio can be read
   * while `generate()` is still sending text. Requests are served in order,
   * so read them in order, one iteration at a time. Audio is queued for
   * pulling only while no `audio` listener is registered.
   * @throws TextToSpeechError if the session fails before the request completes.
   */
  async *audio(flushId?: number): AsyncGenerator<Uint8Array, void, undefined> {
    this.checkPullable();
    if (flushId === undefined) flushId = this.nextFlushId;
    else if (flushId > this.nextFlushId) {
      throw new RangeError(`flush_id ${flushId} has not been flushed yet`);
    }
    const connection = this.queue;
    this.reading = true;
    try {
      for (;;) {
        if (this.queue !== connection) return; // the session reconnected
        // A Cancel drops every request before it and the text being written,
        // whose id it takes.
        if (flushId <= this.cancelledBefore) return;
        if (this.stopped && connection.size === 0) {
          if (this.error) throw this.surfaced();
          return;
        }
        const item = await connection.next();
        switch (item.kind) {
          case "audio":
            if (item.flushId === flushId) yield item.bytes;
            break;
          case "done":
            if (item.flushId === flushId) return;
            break;
          case "cancelled":
            if (item.cancelId >= flushId) return;
            break;
          case "error":
            throw this.surfaced();
          case "closed":
            if (this.error) throw this.surfaced();
            return;
        }
      }
    } finally {
      if (this.queue === connection) this.reading = false;
    }
  }

  /**
   * Ends the session: `Terminate`, then the `Termination` summary.
   *
   * Text sent and not flushed is spoken first. Resolves with the summary,
   * or `undefined` if the session had already ended or the wait timed out.
   * A `connect()` still pending is rejected.
   * @param waitForTermination - Wait for the summary before closing the socket.
   * @param terminateTimeout - Milliseconds to wait for it; `0` waits indefinitely.
   * @throws TextToSpeechError the session's error, when nothing else surfaced it.
   */
  async close(
    waitForTermination = true,
    terminateTimeout = this.params.terminateTimeout ??
      DEFAULT_TERMINATE_TIMEOUT_MS,
  ): Promise<TtsTerminationEvent | undefined> {
    const socket = this.socket;
    this.abortConnect?.(
      new TextToSpeechError("The session was closed before it began"),
    );
    if (socket && !this.stopped && socket.readyState === socket.OPEN) {
      const terminated = new Promise<void>((resolve) => {
        this.terminationResolve = resolve;
      });
      try {
        socket.send(JSON.stringify({ type: "Terminate" }));
      } catch {
        // the socket closed under us; the close handler ends the session
      }
      if (waitForTermination) {
        if (terminateTimeout > 0) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const expired = new Promise<void>((resolve) => {
            timer = setTimeout(resolve, terminateTimeout);
          });
          await Promise.race([terminated, expired]);
          if (timer) clearTimeout(timer);
        } else {
          await terminated;
        }
      }
    }
    this.end();
    this.releaseSocket();
    if (socket) this.emitClose(1000, "Closed by the client");
    if (this.error && !this.errorRaised) throw this.surfaced();
    return this.termination;
  }
}
