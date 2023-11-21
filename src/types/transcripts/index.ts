import { FileUploadParams } from "../files";
import { TranscriptParams } from "../openapi.generated";

export type PollingOptions = {
  /**
   * The amount of time to wait between polling requests.
   * @default 3000 or every 3 seconds
   */
  pollingInterval?: number;
  /**
   * The maximum amount of time to wait for the transcript to be ready.
   * @default -1 which means wait forever
   */
  pollingTimeout?: number;
};

export type CreateTranscriptOptions = {
  /**
   * Whether to poll the transcript until it is ready.
   * @default true
   */
  poll?: boolean;
} & PollingOptions;

/**
 * The audio to transcribe. This can be a public URL, a local file path, a readable file stream, or a file buffer.
 */
export type AudioToTranscribe = FileUploadParams;

/**
 * The parameters to transcribe an audio file.
 */
export type TranscribeParams = { audio: AudioToTranscribe } & Omit<
  TranscriptParams,
  "audio_url"
>;

/**
 * The parameters to start the transcription of an audio file.
 */
export type SubmitParams = TranscribeParams;

/**
 * The options to transcribe an audio file, including polling options.
 */
export type TranscribeOptions = PollingOptions;
