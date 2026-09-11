# No-speech fallback: API gap and regression notes

`language_detection_options.on_no_speech_detected` is an API option surfaced by
the SDK's `LanguageDetectionOptions`. Both `transcripts.submit()` and
`transcripts.transcribe()` serialize it without validation or default injection.
Use `"fallback"` with an explicit `fallback_language` to complete silent audio
with empty text and an explanatory `metadata.warnings` entry. Use `"error"` to
request the error path explicitly. Fallback is a billable successful transcription,
even with empty text; failed transcriptions are not charged. See the
[usage example](../README.md#transcribe-audio-and-video-files),
[API guide](https://www.assemblyai.com/docs/pre-recorded-audio/language-detection#handle-audio-with-no-speech),
and [billing policy](https://www.assemblyai.com/docs/billing-and-pricing#how-billing-works).

## Remaining API work: machine-readable discrimination

The [async transcript response](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/get)
exposes a free-text `error` for failed jobs. Warnings are structured objects, but
their only documented field is the human-readable `message`. They do not carry
a stable code. Empty text can also occur without the no-speech fallback, and other
conditions can generate warnings. Neither empty text nor the presence of a warning
uniquely identifies this condition.

Proposed API request: add a stable error category to failed async transcript
responses and a stable warning category for successful no-speech fallbacks,
preserving existing messages and statuses. Return them consistently from submit,
get, and polling results, and publish their schemas before adding SDK types.
This would let applications distinguish silence without matching message text.

The [Sync API already documents error categories](https://www.assemblyai.com/docs/sync-stt/error-handling):
`bad_audio`, `audio_too_short`, `audio_too_large`, `bad_request`,
`unsupported_media_type`, `capacity_exceeded`, `service_unavailable`,
`inference_timeout`, and `inference_error`. This is a precedent for async parity,
not a promise that async supports these codes. No async implementation or delivery
date has been confirmed. The SDK does not manufacture codes from message strings.

## Types and generation

`TranscriptParams` already referenced `LanguageDetectionOptions`, including
`fallback_language`, `expected_languages`, `code_switching`, and
`code_switching_confidence_threshold`. `Transcript.metadata.warnings` already used
`TranscriptWarning[]` with a `message` field. This change adds the missing
`on_no_speech_detected` literal union and `localization` string array, and clarifies
the existing JSDoc.

These types live in `src/types/openapi.generated.ts`, produced by
`scripts/generate-types.ts` from an external `OPENAPI_SPEC`. The source schema is
not checked into this SDK, and the documented `generate:types` package script is
currently absent. This is a targeted update to the checked-in snapshot, following
the repository's existing type-update practice; a full regeneration was not run.
Future spec synchronization must preserve these fields and the billing guidance.
The published OpenAPI already describes the new fields, but its descriptions
still need the billing guidance and clarification of defaults.

## Regression coverage

Unit tests verify both methods and both `audio`/`audio_url` forms, typed warning
access, option omission, explicit error handling, and preservation of server
validation errors. They mock HTTP responses and do not verify audio detection.

Live tests are opt-in and require a funded API key. Successful transcripts,
including empty fallback results, incur usage charges. With
`ASSEMBLYAI_API_KEY` set, run:

```sh
RUN_NO_SPEECH_INTEGRATION=1 pnpm test:integration --runInBand --runTestsByPath tests/integration/no-speech-detected.test.ts
```

The suite uses generated digital silence unless `NO_SPEECH_SILENT_FIXTURE`
points to a local fixture. To check the distinction between complete silence and
non-speech sound, also set `NO_SPEECH_SOUND_EFFECT_FIXTURE` to a known sound-effect
fixture. That case is skipped when no fixture is supplied. Customer audio is not
bundled in this repository. The sound-effect case explicitly requests `"error"`
so an account's fallback default cannot mask misclassification as silence.

The public documentation describes omitted `on_no_speech_detected` as `"error"`
and asks for an explicit fallback language. Backend source reviewed during this
change accepts an omitted fallback language as English and has account-dependent
no-speech defaults. These findings need live verification and API documentation
alignment. The SDK preserves the server response in either case.

Set `RUN_NO_SPEECH_CONTRACT_TESTS=1` in addition to the live-test flag to probe the
spec's disputed expectations: an omitted option errors, and a missing fallback
language returns HTTP 400. These probes may fail against the newer server
behavior. The normal live suite covers explicit fallback, explicit error, and
rejection of `fallback_language: "auto"`.
