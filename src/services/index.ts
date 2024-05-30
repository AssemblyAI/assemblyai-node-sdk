import { BaseServiceParams } from "..";
import { LemurService } from "./lemur";
import {
  RealtimeTranscriber,
  RealtimeTranscriberFactory,
  RealtimeService,
  RealtimeServiceFactory,
} from "./realtime";
import { TranscriptService } from "./transcripts";
import { FileService } from "./files";

const defaultBaseUrl = "https://api.assemblyai.com";

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
  public realtime: RealtimeTranscriberFactory;

  /**
   * Create a new AssemblyAI client.
   * @param params - The parameters for the service, including the API key and base URL, if any.
   */
  constructor(params: BaseServiceParams) {
    params.baseUrl = params.baseUrl || defaultBaseUrl;
    if (params.baseUrl && params.baseUrl.endsWith("/")) {
      params.baseUrl = params.baseUrl.slice(0, -1);
    }
    this.files = new FileService(params);
    this.transcripts = new TranscriptService(params, this.files);
    this.lemur = new LemurService(params);
    this.realtime = new RealtimeTranscriberFactory(params);
  }
}

export {
  AssemblyAI,
  LemurService,
  RealtimeTranscriberFactory,
  RealtimeTranscriber,
  RealtimeServiceFactory,
  RealtimeService,
  TranscriptService,
  FileService,
};
