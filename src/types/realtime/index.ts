import {
  AudioEncoding,
  FinalTranscript,
  PartialTranscript,
  RealtimeTranscript,
  RealtimeTranscriptType,
} from "../asyncapi.generated";

type CreateRealtimeTranscriberParams = {
  realtimeUrl?: string;
  sampleRate?: number;
  wordBoost?: string[];
  encoding?: AudioEncoding;
} & (
  | {
      apiKey?: string;
    }
  | {
      token: string;
    }
);

/**
 * @deprecated Use CreateRealtimeTranscriberParams instead
 */
type CreateRealtimeServiceParams = CreateRealtimeTranscriberParams;

type RealtimeTranscriberParams = {
  realtimeUrl?: string;
  sampleRate?: number;
  wordBoost?: string[];
  encoding?: AudioEncoding;
} & (
  | {
      apiKey: string;
    }
  | {
      token: string;
    }
);

/**
 * @deprecated Use RealtimeTranscriberParams instead
 */
type RealtimeServiceParams = RealtimeTranscriberParams;

type RealtimeEvents =
  | "open"
  | "close"
  | "transcript"
  | "transcript.partial"
  | "transcript.final"
  | "error";

type SessionBeginsEventData = {
  sessionId: string;
  expiresAt: Date;
};

type RealtimeListeners = {
  open?: (event: SessionBeginsEventData) => void;
  close?: (code: number, reason: string) => void;
  transcript?: (transcript: RealtimeTranscript) => void;
  "transcript.partial"?: (transcript: PartialTranscript) => void;
  "transcript.final"?: (transcript: FinalTranscript) => void;
  error?: (error: Error) => void;
};

type RealtimeTokenParams = {
  expires_in: number;
};

export type {
  CreateRealtimeTranscriberParams,
  RealtimeTranscriberParams,
  CreateRealtimeServiceParams,
  RealtimeServiceParams,
  RealtimeEvents,
  RealtimeTranscriptType,
  SessionBeginsEventData,
  RealtimeListeners,
  RealtimeTokenParams,
};
