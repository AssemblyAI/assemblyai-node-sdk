import { BaseService } from "@/services/base";
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
  WordSearchResponse,
} from "@/types";
import { AxiosInstance } from "axios";
import { FileService } from "../files";

export class TranscriptService
  extends BaseService
  implements
    Createable<Transcript, CreateTranscriptParameters, CreateTranscriptOptions>,
    Retrieveable<Transcript>,
    Deletable<Transcript>,
    Listable<TranscriptList>
{
  constructor(client: AxiosInstance, private files: FileService) {
    super(client);
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

    const res = await this.client.post<Transcript>("/v2/transcript", params);

    if (options?.poll ?? true) {
      return await this.poll(res.data.id, options);
    }

    return res.data;
  }

  private async poll(
    transcriptId: string,
    options?: CreateTranscriptOptions
  ): Promise<Transcript> {
    const startTime = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const transcript = await this.get(transcriptId);
      if (transcript.status === "completed" || transcript.status === "error") {
        return transcript;
      } else if (
        Date.now() - startTime <
        (options?.pollingTimeout ?? 180_000)
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, options?.pollingInterval ?? 3_000)
        );
      } else {
        throw new Error("Polling timeout");
      }
    }
  }

  /**
   * Retrieve a transcript.
   * @param id The identifier of the transcript.
   * @returns A promise that resolves to the transcript.
   */
  async get(id: string): Promise<Transcript> {
    const res = await this.client.get<Transcript>(`/v2/transcript/${id}`);
    return res.data;
  }

  // TODO: add options overload to support list querystring parameters
  /**
   * Retrieves a paged list of transcript listings.
   * @param nextUrl The URL to retrieve the transcript list from. If not provided, the first page will be retrieved.
   * @returns
   */
  async list(nextUrl?: string | null): Promise<TranscriptList> {
    const { data } = await this.client.get<TranscriptList>(
      nextUrl ?? "/v2/transcript"
    );
    for (const transcriptListItem of data.transcripts) {
      transcriptListItem.created = new Date(transcriptListItem.created);
      if (transcriptListItem.completed) {
        transcriptListItem.completed = new Date(transcriptListItem.completed);
      }
    }

    return data as unknown as TranscriptList;
  }

  /**
   * Delete a transcript
   * @param id The identifier of the transcript.
   * @returns A promise that resolves to the transcript.
   */
  async delete(id: string): Promise<Transcript> {
    const res = await this.client.delete<Transcript>(`/v2/transcript/${id}`);
    return res.data;
  }

  /**
   * Search through the transcript for a specific set of keywords.
   * You can search for individual words, numbers, or phrases containing up to five words or numbers.
   * @param id The identifier of the transcript.
   * @param id Keywords to search for.
   * @return A promise that resolves to the sentences.
   */
  async wordSearch(id: string, words: string[]): Promise<WordSearchResponse> {
    const { data } = await this.client.get<WordSearchResponse>(
      `/v2/transcript/${id}/word-search`,
      {
        params: {
          words: JSON.stringify(words),
        },
      }
    );
    return data;
  }

  /**
   * Retrieve all sentences of a transcript.
   * @param id The identifier of the transcript.
   * @return A promise that resolves to the sentences.
   */
  async sentences(id: string): Promise<SentencesResponse> {
    const { data } = await this.client.get<SentencesResponse>(
      `/v2/transcript/${id}/sentences`
    );
    return data;
  }

  /**
   * Retrieve all paragraphs of a transcript.
   * @param id The identifier of the transcript.
   * @return A promise that resolves to the paragraphs.
   */
  async paragraphs(id: string): Promise<ParagraphsResponse> {
    const { data } = await this.client.get<ParagraphsResponse>(
      `/v2/transcript/${id}/paragraphs`
    );
    return data;
  }

  /**
   * Retrieve subtitles of a transcript.
   * @param id The identifier of the transcript.
   * @param format The format of the subtitles.
   * @return A promise that resolves to the subtitles text.
   */
  async subtitles(id: string, format: SubtitleFormat = "srt"): Promise<string> {
    const { data } = await this.client.get<string>(
      `/v2/transcript/${id}/${format}`
    );

    return data;
  }

  /**
   * Retrieve redactions of a transcript.
   * @param id The identifier of the transcript.
   * @return A promise that resolves to the subtitles text.
   */
  async redactions(id: string): Promise<RedactedAudioResponse> {
    const { data } = await this.client.get<RedactedAudioResponse>(
      `/v2/transcript/${id}/redacted-audio`
    );
    return data;
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
