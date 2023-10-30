type FileUploadParameters = string | FileUploadData;
type FileUploadData =
  | NodeJS.ReadableStream
  | ReadableStream
  | Blob
  | BufferSource
  | ArrayBufferView
  | ArrayBufferLike
  | Uint8Array;

export type { FileUploadParameters, FileUploadData };
