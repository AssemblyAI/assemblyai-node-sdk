import { BaseService } from "../base";
import {
  ParagraphsResponse,
  SentencesResponse,
  Transcript,
  TranscriptList,
  CreateTranscriptParameters,
  CreateTranscriptOptions,
  Createable,
  Deletable,
  Listable,
  Retrieveable,
  SubtitleFormat,
  RedactedAudioResponse,
  TranscriptListParameters,
  WordSearchResponse,
  BaseServiceParams,
  PollingOptions,
} from "../..";
import { FileService } from "../files";

export class TranscriptService
  extends BaseService
  implements
    Createable<Transcript, CreateTranscriptParameters, CreateTranscriptOptions>,
    Retrieveable<Transcript>,
    Deletable<Transcript>,
    Listable<TranscriptList>
{
  constructor(params: BaseServiceParams, private files: FileService) {
    super(params);
  }

  /**
   * Create a transcript.
   * @param params The parameters to create a transcript.
   * @param options The options used for creating the new transcript.
   * @returns A promise that resolves to the newly created transcript.
   */
  async create(
    params: CreateTranscriptParameters,
    options?: CreateTranscriptOptions
  ): Promise<Transcript> {
    const path = getPath(params.audio_url);
    if (path !== null) {
      const uploadUrl = await this.files.upload(path);
      params.audio_url = uploadUrl;
    }

    const data = await this.fetchJson<Transcript>("/v2/transcript", {
      method: "POST",
      body: JSON.stringify(params),
    });

    if (options?.poll ?? true) {
      return await this.waitUntilReady(data.id, options);
    }

    return data;
  }

  async waitUntilReady(
    transcriptId: string,
    options?: PollingOptions
  ): Promise<Transcript> {
    const pollingInterval = options?.pollingInterval ?? 3_000;
    const pollingTimeout = options?.pollingTimeout ?? -1;
    const startTime = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const transcript = await this.get(transcriptId);
      if (transcript.status === "completed" || transcript.status === "error") {
        return transcript;
      } else if (
        pollingTimeout > 0 &&
        Date.now() - startTime > pollingTimeout
      ) {
        throw new Error("Polling timeout");
      } else {
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      }
    }
  }

  /**
   * Retrieve a transcript.
   * @param id The identifier of the transcript.
   * @returns A promise that resolves to the transcript.
   */
  get(id: string): Promise<Transcript> {
    return this.fetchJson<Transcript>(`/v2/transcript/${id}`);
  }

  /**
   * Retrieves a page of transcript listings.
   * @param parameters The parameters to filter the transcript list by, or the URL to retrieve the transcript list from.
   */
  async list(
    parameters?: TranscriptListParameters | string
  ): Promise<TranscriptList> {
    let url = "/v2/transcript";
    if (typeof parameters === "string") {
      url = parameters;
    } else if (parameters) {
      url = `${url}?${new URLSearchParams(
        Object.keys(parameters).map((key) => [
          key,
          parameters[key as keyof TranscriptListParameters]?.toString() || "",
        ])
      )}`;
    }
    const data = await this.fetchJson<TranscriptList>(url);
    for (const transcriptListItem of data.transcripts) {
      transcriptListItem.created = new Date(transcriptListItem.created);
      if (transcriptListItem.completed) {
        transcriptListItem.completed = new Date(transcriptListItem.completed);
      }
    }

    return data;
  }

  /**
   * Delete a transcript
   * @param id The identifier of the transcript.
   * @returns A promise that resolves to the transcript.
   */
  delete(id: string): Promise<Transcript> {
    return this.fetchJson(`/v2/transcript/${id}`, { method: "DELETE" });
  }

  /**
   * Search through the transcript for a specific set of keywords.
   * You can search for individual words, numbers, or phrases containing up to five words or numbers.
   * @param id The identifier of the transcript.
   * @param words Keywords to search for.
   * @return A promise that resolves to the sentences.
   */
  wordSearch(id: string, words: string[]): Promise<WordSearchResponse> {
    const params = new URLSearchParams({ words: words.join(",") });
    return this.fetchJson<WordSearchResponse>(
      `/v2/transcript/${id}/word-search?${params.toString()}`
    );
  }

  /**
   * Retrieve all sentences of a transcript.
   * @param id The identifier of the transcript.
   * @return A promise that resolves to the sentences.
   */
  sentences(id: string): Promise<SentencesResponse> {
    return this.fetchJson<SentencesResponse>(`/v2/transcript/${id}/sentences`);
  }

  /**
   * Retrieve all paragraphs of a transcript.
   * @param id The identifier of the transcript.
   * @return A promise that resolves to the paragraphs.
   */
  paragraphs(id: string): Promise<ParagraphsResponse> {
    return this.fetchJson<ParagraphsResponse>(
      `/v2/transcript/${id}/paragraphs`
    );
  }

  /**
   * Retrieve subtitles of a transcript.
   * @param id The identifier of the transcript.
   * @param format The format of the subtitles.
   * @param chars_per_caption The maximum number of characters per caption.
   * @return A promise that resolves to the subtitles text.
   */
  async subtitles(
    id: string,
    format: SubtitleFormat = "srt",
    chars_per_caption?: number
  ): Promise<string> {
    let url = `/v2/transcript/${id}/${format}`;
    if (chars_per_caption) {
      const params = new URLSearchParams();
      params.set("chars_per_caption", chars_per_caption.toString());
      url += `?${params.toString()}`;
    }
    const response = await this.fetch(url);
    return await response.text();
  }

  /**
   * Retrieve redactions of a transcript.
   * @param id The identifier of the transcript.
   * @return A promise that resolves to the subtitles text.
   */
  redactions(id: string): Promise<RedactedAudioResponse> {
    return this.fetchJson<RedactedAudioResponse>(
      `/v2/transcript/${id}/redacted-audio`
    );
  }
}

function getPath(path: string) {
  let url: URL;
  try {
    url = new URL(path);
    if (url.protocol === "file:") return url.pathname;
    else return null;
  } catch {
    return path;
  }
}
