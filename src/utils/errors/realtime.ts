enum RealtimeErrorType {
  BadSampleRate = 4000,
  AuthFailed = 4001,
  // Both InsufficientFunds and FreeAccount error use 4002
  InsufficientFundsOrFreeAccount = 4002,
  NonexistentSessionId = 4004,
  SessionExpired = 4008,
  ClosedSession = 4010,
  RateLimited = 4029,
  UniqueSessionViolation = 4030,
  SessionTimeout = 4031,
  AudioTooShort = 4032,
  AudioTooLong = 4033,
  BadJson = 4100,
  BadSchema = 4101,
  TooManyStreams = 4102,
  Reconnected = 4103,
  ReconnectAttemptsExhausted = 1013,
}

const RealtimeErrorMessages: Record<RealtimeErrorType, string> = {
  [RealtimeErrorType.BadSampleRate]: "Sample rate must be a positive integer",
  [RealtimeErrorType.AuthFailed]: "Not Authorized",
  [RealtimeErrorType.InsufficientFundsOrFreeAccount]:
    "Insufficient funds or you are using a free account. This feature is paid-only and requires you to add a credit card. Please visit https://assemblyai.com/dashboard/ to add a credit card to your account.",
  [RealtimeErrorType.NonexistentSessionId]: "Session ID does not exist",
  [RealtimeErrorType.SessionExpired]: "Session has expired",
  [RealtimeErrorType.ClosedSession]: "Session is closed",
  [RealtimeErrorType.RateLimited]: "Rate limited",
  [RealtimeErrorType.UniqueSessionViolation]: "Unique session violation",
  [RealtimeErrorType.SessionTimeout]: "Session Timeout",
  [RealtimeErrorType.AudioTooShort]: "Audio too short",
  [RealtimeErrorType.AudioTooLong]: "Audio too long",
  [RealtimeErrorType.BadJson]: "Bad JSON",
  [RealtimeErrorType.BadSchema]: "Bad schema",
  [RealtimeErrorType.TooManyStreams]: "Too many streams",
  [RealtimeErrorType.Reconnected]: "Reconnected",
  [RealtimeErrorType.ReconnectAttemptsExhausted]:
    "Reconnect attempts exhausted",
};

class RealtimeError extends Error {}

export { RealtimeError, RealtimeErrorType, RealtimeErrorMessages };
