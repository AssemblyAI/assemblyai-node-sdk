import {
  FinalTranscript,
  PartialTranscript,
  RealtimeTranscript,
  RealtimeTranscriptType,
} from "../asyncapi.generated";

type CreateRealtimeServiceParams = {
  realtimeUrl?: string;
  sampleRate?: number;
  wordBoost?: string[];
} & (
  | {
      apiKey?: string;
    }
  | {
      token: string;
    }
);

type RealtimeServiceParams = {
  realtimeUrl?: string;
  sampleRate?: number;
  wordBoost?: string[];
} & (
  | {
      apiKey: string;
    }
  | {
      token: string;
    }
);

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
  CreateRealtimeServiceParams,
  RealtimeServiceParams,
  RealtimeEvents,
  RealtimeTranscriptType,
  SessionBeginsEventData,
  RealtimeListeners,
  RealtimeTokenParams,
};
