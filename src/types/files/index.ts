type FileUploadParameters = string | FileUploadData;
type FileUploadData =
  | NodeJS.ReadableStream
  | ReadableStream
  | Buffer
  | ArrayBufferView
  | ArrayBufferLike
  | Uint8Array;

export type { FileUploadParameters, FileUploadData };
