import { FileUploadParams } from "./files";
import {
  CreateRealtimeTemporaryTokenParams,
  ListTranscriptParams,
  TranscriptOptionalParams,
  TranscriptParams,
} from "./openapi.generated";
import { SubmitParams, TranscribeParams } from "./transcripts";

/**
 * @deprecated
 * Use`FileUploadParams` instead.
 */
export type FileUploadParameters = FileUploadParams;

/**
 * @deprecated
 * Use`TranscribeParams` instead.
 */
export type TranscribeParameters = TranscribeParams;

/**
 * @deprecated
 * Use`SubmitParams` instead.
 */
export type SubmitParameters = SubmitParams;

/**
 * @deprecated
 * Use`CreateRealtimeTemporaryTokenParams` instead.
 */
export type CreateRealtimeTemporaryTokenParameters =
  CreateRealtimeTemporaryTokenParams;
/**
 * @deprecated
 * Use`ListTranscriptParams` instead.
 */
export type TranscriptListParameters = ListTranscriptParams;
/**
 * @deprecated
 * Use`TranscriptOptionalParams` instead.
 */
export type CreateTranscriptOptionalParameters = TranscriptOptionalParams;
/**
 * @deprecated
 * Use`TranscriptParams` instead.
 */
export type CreateTranscriptParameters = TranscriptParams;
