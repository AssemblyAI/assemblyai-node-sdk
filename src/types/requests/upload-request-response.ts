/**
 * The request and response object used in the {@link AssemblyClient.upload} function.
 * Uploads can be used to upload media files directly to the AssemblyAI API for transcription.
 */
export class UploadRequestResponse {
  /**
   * A URL that points to your audio file, accessible only by AssemblyAI's servers.
   */
  upload_url?: string;
}
