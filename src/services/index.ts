import { createAxiosClient } from "@/utils/axios";
import { BaseServiceParams } from "@/types";
import { LemurService } from "./lemur";
import { RealtimeService, RealtimeServiceFactory } from "./realtime";
import { TranscriptService } from "./transcripts";
import { FileService } from "./files";

class AssemblyAI {
  /**
   * The files service.
   */
  public files: FileService;

  /**
   * The transcripts service.
   */
  public transcripts: TranscriptService;

  /**
   * The LeMUR service.
   */
  public lemur: LemurService;

  /**
   * The realtime service.
   */
  public realtime: RealtimeServiceFactory;

  /**
   * Create a new AssemblyAI client.
   * @param params The parameters for the service, including the API key and base URL, if any.
   */
  constructor(params: BaseServiceParams) {
    params.baseUrl = params.baseUrl || "https://api.assemblyai.com";
    const client = createAxiosClient(params);
    this.files = new FileService(client);
    this.transcripts = new TranscriptService(client, this.files);
    this.lemur = new LemurService(client);
    this.realtime = new RealtimeServiceFactory(client, params);
  }
}

export {
  AssemblyAI,
  LemurService,
  RealtimeServiceFactory,
  RealtimeService,
  TranscriptService,
  FileService,
};
