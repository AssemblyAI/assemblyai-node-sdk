import { BaseServiceParams } from "..";
import { SyncTranscriber, SyncLiveSession } from "./sync";
import { DictationTranscriber, DictationLiveSession } from "./dictation";
import { LlmGatewayService } from "./llm-gateway";
import {
  SyncTranscriptError,
  DictationError,
  LlmGatewayError,
} from "../utils/errors";
import {
  RealtimeTranscriber,
  RealtimeTranscriberFactory,
  RealtimeService,
  RealtimeServiceFactory,
} from "./realtime";
import { TranscriptService } from "./transcripts";
import { FileService } from "./files";
import {
  StreamingTranscriber,
  StreamingTranscriberFactory,
  DualChannelCapture,
  EnergyVad,
  LinearResampler,
  VadTimeline,
  attributeTurn,
  attributeWord,
  rollUpTurnChannel,
  float32ToPcm16,
} from "./streaming";

const defaultBaseUrl = "https://api.assemblyai.com";
const defaultStreamingUrl = "https://streaming.assemblyai.com";
const defaultSyncUrl = "https://sync.assemblyai.com";
const defaultDictationUrl = "https://dictation.assemblyai.com";
const defaultLlmGatewayUrl = "https://llm-gateway.assemblyai.com";

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
   * The realtime service.
   */
  public realtime: RealtimeTranscriberFactory;

  /**
   * The streaming service.
   */
  public streaming: StreamingTranscriberFactory;

  /**
   * The synchronous transcription service.
   */
  public sync: SyncTranscriber;

  /**
   * The dictation service.
   */
  public dictation: DictationTranscriber;

  /**
   * The LLM Gateway service.
   */
  public llmGateway: LlmGatewayService;

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
    this.realtime = new RealtimeTranscriberFactory(params);

    this.streaming = new StreamingTranscriberFactory({
      ...params,
      baseUrl: params.streamingBaseUrl || defaultStreamingUrl,
    });

    let syncBaseUrl = params.syncBaseUrl || defaultSyncUrl;
    if (syncBaseUrl.endsWith("/")) {
      syncBaseUrl = syncBaseUrl.slice(0, -1);
    }
    this.sync = new SyncTranscriber({
      ...params,
      baseUrl: syncBaseUrl,
    });

    let dictationBaseUrl = params.dictationBaseUrl || defaultDictationUrl;
    if (dictationBaseUrl.endsWith("/")) {
      dictationBaseUrl = dictationBaseUrl.slice(0, -1);
    }
    this.dictation = new DictationTranscriber({
      ...params,
      baseUrl: dictationBaseUrl,
    });

    let llmGatewayBaseUrl = params.llmGatewayBaseUrl || defaultLlmGatewayUrl;
    if (llmGatewayBaseUrl.endsWith("/")) {
      llmGatewayBaseUrl = llmGatewayBaseUrl.slice(0, -1);
    }
    this.llmGateway = new LlmGatewayService({
      ...params,
      baseUrl: llmGatewayBaseUrl,
    });
  }
}

export {
  AssemblyAI,
  SyncTranscriber,
  SyncLiveSession,
  SyncTranscriptError,
  DictationTranscriber,
  DictationLiveSession,
  DictationError,
  LlmGatewayService,
  LlmGatewayError,
  RealtimeTranscriberFactory,
  RealtimeTranscriber,
  RealtimeServiceFactory,
  RealtimeService,
  TranscriptService,
  FileService,
  StreamingTranscriber,
  DualChannelCapture,
  EnergyVad,
  LinearResampler,
  VadTimeline,
  attributeTurn,
  attributeWord,
  rollUpTurnChannel,
  float32ToPcm16,
};
