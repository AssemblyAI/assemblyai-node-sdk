import { readFile } from "fs/promises";
import { BaseService } from "@/services/base";
import { UploadedFile } from "@/types";

export class FileService extends BaseService {
  /**
   * Upload a local file to AssemblyAI.
   * @param path The local file to upload.
   * @return A promise that resolves to the uploaded file URL.
   */
  async upload(path: string): Promise<string> {
    const file = await readFile(path);

    const { data } = await this.client.post<UploadedFile>("/v2/upload", file, {
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });

    return data.upload_url;
  }
}
