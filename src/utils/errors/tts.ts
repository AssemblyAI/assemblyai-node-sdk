/** The fields a Text-to-Speech failure carries besides its message. */
export type TextToSpeechErrorFields = {
  /**
   * The HTTP status. On a session, only a refused WebSocket upgrade has one,
   * and only where the runtime reports it (Node does, a browser does not).
   */
  status?: number;
  /** The API's stable code: `invalid_parameter`, `voice_not_found`, `rate_limited`, ... */
  errorCode?: string;
  /** The field at fault, if one. */
  param?: string;
  /** The request's id, or the session's id on a session. */
  requestId?: string;
  /** Whether the same request, or a new session, can succeed later. */
  retryable?: boolean;
  /** Seconds to wait before retrying, when the API said. */
  retryAfter?: number;
  /** For `invalid_parameter`, every failing field. */
  errors?: { message: string; param: string | null }[];
  /** The WebSocket close code that ended a session. */
  closeCode?: number;
  /** The whole error envelope or frame the API sent. */
  body?: Record<string, unknown>;
};

/** HTTP statuses at which the same request, or a new session, can succeed later. */
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([
  408, 429, 500, 502, 503, 504,
]);

/**
 * Error thrown when a Text-to-Speech request or session fails.
 *
 * Branch on `errorCode`, not on the message, which may be reworded.
 */
export class TextToSpeechError
  extends Error
  implements TextToSpeechErrorFields
{
  override name = "TextToSpeechError";
  status?: number;
  errorCode?: string;
  param?: string;
  requestId?: string;
  retryable?: boolean;
  retryAfter?: number;
  errors?: { message: string; param: string | null }[];
  closeCode?: number;
  body?: Record<string, unknown>;

  constructor(message: string, fields: TextToSpeechErrorFields = {}) {
    super(message);
    Object.assign(this, fields);
  }
}
