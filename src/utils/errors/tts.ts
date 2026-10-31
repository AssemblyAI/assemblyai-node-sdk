import { AssemblyAIError } from "./assemblyai";

/** The fields a Text-to-Speech failure carries besides its message. */
export type TextToSpeechErrorFields = {
  /**
   * The HTTP status. On a session, only a refused WebSocket upgrade has one,
   * and only where the runtime reports it (Node does, a browser does not).
   */
  status?: number;
  /**
   * The API's stable code, the same on HTTP and on a session. Among them:
   * - `invalid_parameter` (422; close 3006): `param` and `errors` say which field.
   * - `rate_limited` (429, retryable; close 3009): wait `retryAfter` seconds.
   * - `voice_not_found` (422; close 3012, `param: "voice_id"`).
   * - `voice_expired` (422; close 3012, `param: "voice_id"`): the cloned
   *   voice's consent period ended; its owner can create it again from a new
   *   recording.
   * - `voice_not_paired` (422; close 3014, `param: "model_id"`): the cloned
   *   voice is not paired with the model, or the pairing is still in progress.
   * - `not_owner` (422; close 3006, `param: "extend_biometric_consent"`):
   *   `extend_biometric_consent` on a voice another account owns.
   * - `biometric_terms_not_accepted` (403, not retryable; close 3006,
   *   `param` `voice_id` or `extend_biometric_consent`): the account has not
   *   accepted the biometric data terms that its own cloned voices and
   *   `extend_biometric_consent` need; accept them on the data controls page
   *   of the AssemblyAI dashboard.
   * - `auth_unavailable` (503, retryable; close 1011): the credential, or the
   *   account's biometric data terms, could not be checked just now.
   *
   * Absent on a refusal of `createTemporaryToken()`, whose message carries
   * the token service's reason.
   */
  errorCode?: string;
  /** The field at fault, if one. */
  param?: string;
  /**
   * The request's id; on a session, the session's id from `Begin`, so a
   * session refused before `Begin` has none: read `errorCode` and `closeCode`.
   */
  requestId?: string;
  /** Whether the same request, or a new session, can succeed later. */
  retryable?: boolean;
  /** Seconds to wait before retrying, when the API said. */
  retryAfter?: number;
  /** For `invalid_parameter`, every failing field. */
  errors?: { message: string; param: string | null }[];
  /** The WebSocket close code that ended a session; see `errorCode` for the codes. */
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
  extends AssemblyAIError
  implements TextToSpeechErrorFields
{
  override name = "TextToSpeechError";
  errorCode?: string;
  param?: string;
  requestId?: string;
  retryable?: boolean;
  errors?: { message: string; param: string | null }[];
  closeCode?: number;
  body?: Record<string, unknown>;

  constructor(message: string, fields: TextToSpeechErrorFields = {}) {
    super(message, fields.status, fields.retryAfter);
    Object.assign(this, fields);
  }
}
