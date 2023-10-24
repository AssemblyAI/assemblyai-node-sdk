// import the fs module instead if specific named exports
// to keep the assemblyai module more compatible. Some fs polyfills don't include `createReadStream`.
import fs from "fs";
import { BaseService } from "@/services/base";
import { UploadedFile, FileUploadParameters, FileUploadData } from "@/types";

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

    const { data } = await this.client.post<UploadedFile>(
      "/v2/upload",
      fileData,
      {
        headers: {
          "Content-Type": "application/octet-stream",
        },
      }
    );

    return data.upload_url;
  }
}
