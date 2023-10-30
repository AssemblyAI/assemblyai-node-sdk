// import the fs module instead if specific named exports
// to keep the assemblyai module more compatible. Some fs polyfills don't include `createReadStream`.
import fs from "fs";
import { BaseService } from "../base";
import { UploadedFile, FileUploadParameters, FileUploadData } from "../..";

export class FileService extends BaseService {
  /**
   * Upload a local file to AssemblyAI.
   * @param input The local file path to upload, or a stream or buffer of the file to upload.
   * @return A promise that resolves to the uploaded file URL.
   */
  async upload(input: FileUploadParameters): Promise<string> {
    let fileData: FileUploadData;
    if (typeof input === "string") fileData = fs.createReadStream(input);
    else fileData = input;

    const data = await this.fetchJson<UploadedFile>("/v2/upload", {
      method: "POST",
      body: fileData as BodyInit,
      headers: {
        "Content-Type": "application/octet-stream",
      },
      duplex: "half",
    } as RequestInit);
    return data.upload_url;
  }
}
