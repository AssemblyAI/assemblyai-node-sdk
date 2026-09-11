# AssemblyAI Node.js SDK

Speech-to-text and audio intelligence SDK for Node.js, Deno, and Bun. Supports pre-recorded transcription, real-time streaming, and audio analysis features.

## Quick start

```bash
npm install assemblyai
```

```typescript
import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});

const transcript = await client.transcripts.transcribe({
  audio: "https://example.com/audio.mp3",
  speech_models: ["universal-3-5-pro", "universal-2"],
  speaker_labels: true,
});

console.log(transcript.text);
for (const utterance of transcript.utterances) {
  console.log(`Speaker ${utterance.speaker}: ${utterance.text}`);
}
```

## Auth

```typescript
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});
```

## Key APIs

- `client.transcripts.transcribe(params)` — Transcribe and poll until complete
- `client.transcripts.submit(params)` — Submit without waiting (fire-and-forget)
- `client.transcripts.get(id)` — Retrieve a transcript by ID
- `client.transcripts.list()` — List transcripts with pagination
- `client.transcripts.delete(id)` — Delete a transcript
- `client.sync.transcribe(audio, config?, options?)` — Synchronous transcription: audio in, transcript out, one request (no polling)
- `client.sync.transcribeLive(audio, config?, options?)` — Sync transcription that uploads a stream or iterable of audio chunks while the audio is still being recorded
- `client.sync.openLive(config?, options?)` — Open a live sync upload that audio is pushed into (`write()` / `close()` / `result()`), for callback-driven sources
- `client.dictation.transcribeLive(audio, config?, options?)` — Dictation: upload a short spoken note as it is spoken and get one finished transcript back, optionally rewritten by an LLM
- `client.dictation.openLive(config?, options?)` — Open a dictation upload that audio is pushed into (`write()` / `close()` / `result()`), for callback-driven sources
- `client.dictation.warm()` — Pre-open the connection to the dictation API so the next request skips the handshake
- `client.streaming.transcriber(params)` — Create a real-time streaming session
- `client.llmGateway.chatCompletions(request)` — OpenAI-compatible chat completions
- `client.llmGateway.listModels()` — List models available on the LLM Gateway
- `client.llmGateway.understanding(request)` / `client.llmGateway.validateUnderstanding(request)` — Run or validate a Speech Understanding request

## Common patterns

**Transcribe a local file:**

```typescript
const transcript = await client.transcripts.transcribe({
  audio: "./recording.mp3",
});
```

**With multiple features:**

```typescript
const transcript = await client.transcripts.transcribe({
  audio: audioUrl,
  speech_models: ["universal-3-5-pro", "universal-2"],
  speaker_labels: true,
  sentiment_analysis: true,
  entity_detection: true,
  auto_chapters: true,
  language_detection: true,
});
```

**Streaming:**

```typescript
const transcriber = client.streaming.transcriber({
  speechModel: "universal-3-5-pro",
  sampleRate: 16_000,
});

transcriber.on("turn", (turn) => {
  console.log(turn.text);
});

await transcriber.connect();
// Send audio chunks: transcriber.sendAudio(chunk)
await transcriber.close();
```

For voice agents, `agentContext` (the agent's last reply, U3Pro only) is settable
at connect time and updatable mid-stream after each agent turn:
`transcriber.updateConfiguration({ agent_context: "..." })`.

**Speaker revisions** (`speakerRevision` event, diarization-only — emitted only
when `speakerLabels` is enabled). Sent once per offline-recluster resolve; each
message batches every earlier Turn whose speaker label changed (unchanged turns
are omitted). For each `revisions[i]`, match `turn_order` against the original
Turn and replace its per-word `speaker` (and the turn-level `speaker_label`)
with the revision's values — text and word timestamps are unchanged:

```typescript
transcriber.on("speakerRevision", (event) => {
  for (const r of event.revisions) {
    // r.turn_order, r.speaker_label, r.words[i].speaker
  }
});
```

**Dual-channel streaming (e.g. mic + system audio in a browser):**

Dual-channel mode is configured on `StreamingTranscriber` itself by passing
`channels`. All mixing, per-channel VAD, and per-word channel attribution
happen inside the transcriber — runtime-agnostic, no browser required. Callers
push tagged PCM via `sendAudio(pcm, { channel })`.

For browsers, `DualChannelCapture` is a thin helper that pumps two
`MediaStream`s into the transcriber:

```typescript
import { AssemblyAI, DualChannelCapture } from "assemblyai";

const micStream = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: true, noiseSuppression: true },
});
const systemStream = await navigator.mediaDevices.getDisplayMedia({
  audio: true,
});

const transcriber = client.streaming.transcriber({
  speechModel: "universal-3-5-pro",
  sampleRate: 16_000,
  speakerLabels: true,
  channels: [{ name: "mic" }, { name: "system" }],
});

transcriber.on("turn", (turn) => {
  // turn.words[i].channel: "mic" | "system" | "unknown"  (physical channel)
  // turn.channel: duration-weighted rollup
  // turn.speaker_label: AAI diarization, passed through unchanged
});

const capture = new DualChannelCapture({
  micStream,
  systemStream,
  transcriber,
});

await transcriber.connect();
await capture.start();
```

For non-browser runtimes (Node, telephony, file replay), bypass the helper and
push tagged PCM directly:

```typescript
const transcriber = client.streaming.transcriber({
  speechModel: "universal-3-5-pro",
  sampleRate: 16_000,
  channels: [{ name: "mic" }, { name: "system" }],
});

await transcriber.connect();
transcriber.sendAudio(micPcm, { channel: "mic" });
transcriber.sendAudio(systemPcm, { channel: "system" });
```

Channel attribution is additive — AAI's `speaker_label` / `words[i].speaker` are
never overwritten. Echo cancellation must be set at `getUserMedia` time; the
helper does not modify caller-provided MediaStream constraints. macOS needs a
loopback driver (BlackHole, Loopback.app) for `getDisplayMedia` system audio.

**Subtitles:**

```typescript
const srt = await client.transcripts.subtitles(id, "srt");
const vtt = await client.transcripts.subtitles(id, "vtt");
```

## Sync transcription (pre-recorded, single request)

`client.sync` posts a whole audio file and returns the finished transcript in one
round trip — no job id, no polling, no status enum. It targets the sync API host
(`sync.assemblyai.com`, override with the `syncBaseUrl` client option), distinct
from `client.transcripts`' async job API. Use it for short clips where you want the
answer inline; use `client.transcripts` for long-form audio, URLs, or the rich
audio-intelligence features (speaker labels, chapters, sentiment, …) the sync API
doesn't expose. This is the Node counterpart of the Python SDK's `SyncTranscriber`.

```typescript
const result = await client.sync.transcribe("./call.wav");
console.log(result.text, result.session_id);
for (const w of result.words) {
  console.log(w.text, w.confidence); // w.start/w.end need timestamps: true (see below)
}
```

**Input**: a local file path (Node/Bun/Deno), raw bytes (`Uint8Array`/`ArrayBuffer`),
a Blob/File, or a readable stream. **Not** a URL — pass a path/bytes or use
`client.transcripts` for URL ingestion.

**Config** (all optional, second argument):

```typescript
const result = await client.sync.transcribe("./call.wav", {
  prompt: "Transcribe verbatim. Preserve disfluencies.", // max 4096 chars, rejected over
  keyterms_prompt: ["AssemblyAI", "Lemur", "U3-Pro"], // max 2048 chars total, rejected over
  language_codes: ["es"], // or e.g. ["en", "es"] for multilingual; defaults to English; ignored when prompt is set
  conversation_context: [
    // prior turns oldest-first; capped at 100 turns / 4096 chars — trimmed, not rejected
    "I'd like to book a flight to Denver.",
    "Sure, what date were you thinking?",
  ],
});
```

**Word timestamps** are opt-in. By default words carry `text` and `confidence` only —
`start`/`end` are not calculated. `timestamps: true` computes accurate per-word
timings at a small latency cost:

```typescript
const result = await client.sync.transcribe("./call.wav", { timestamps: true });
for (const w of result.words) {
  console.log(w.text, w.start, w.end); // milliseconds
}
```

**Raw PCM** (S16LE) needs `sample_rate` + `channels`; WAV reads them from its header.
Setting either field routes the audio as `audio/pcm`, and both must be present:

```typescript
const result = await client.sync.transcribe(rawPcmBytes, {
  sample_rate: 16000,
  channels: 1,
});
```

**Model**: `config.model` defaults to `"universal-3-5-pro"` and is sent as the
`X-AAI-Model` routing header — never in the request body.

**Errors**: failures throw `SyncTranscriptError` with `.status`, a
machine-readable `.errorCode` (snake_cased problem-details title: `bad_audio`,
`audio_too_short`, `audio_too_large`, `capacity_exceeded`, `inference_timeout`, …),
and `.retryAfter` (seconds) on 429/503. Audio limits: 80 ms–120 s, ≤40 MB, 16-bit,
mono/stereo, sample rate ∈ {8000, 16000, 22050, 24000, 32000, 44100, 48000}.

**Pre-warming**: the sync API is one request/response, so a `transcribe()` that
connects on demand pays the full DNS + TCP + TLS handshake on the critical path.
Call `await client.sync.warm()` as soon as you know audio is coming (e.g. while
it is still being recorded); it returns `true` once the socket is open, `false` on
a transport failure. Call it shortly before `transcribe()` — the pooled connection
idles out after a few seconds.

**Live upload**: `transcribeLive()` and `openLive()` post to `/v1/transcribe/stream` with a
chunked multipart body, so the request starts before the audio exists and chunks upload as they
arrive. Authorization, the upload and every speech segment but the last resolve while the caller
is still recording; only the final segment is left to wait for. `transcribeLive()` pulls from an
async iterable (Node streams included), a sync iterable, or a web `ReadableStream` — bytes, a
Blob or a path are rejected with a TypeError pointing at `transcribe()`. `openLive()` is the
push-style counterpart for callback-driven sources (microphone library, WebRTC track, telephony
media stream) and returns a `SyncLiveSession`: `write(chunk)` (never blocks), `close()` (ends the
audio, idempotent), `result()` (closes if needed, then waits), `abort()` (drops the request),
`closed`, and `stream()` for `source.pipeTo(session.stream())`. This is not `client.streaming`,
which returns words mid-utterance; a live upload returns one finished transcript when the audio
ends.

```typescript
await client.sync.warm(); // open the connection ahead of time (does not validate the key)

const session = client.sync.openLive({ sample_rate: 16_000, channels: 1 });

mic.on("data", (chunk) => session.write(chunk));
mic.on("end", () => session.close());

const result = await session.result();
console.log(result.text);
// Or pull-style, from a stream that is still being written:
// await client.sync.transcribeLive(recorder.stdout, { sample_rate: 16_000, channels: 1 });
```

The win is overlapping the upload with the recording, so it needs audio that is genuinely still
being produced — streaming a file already on disk is slower than `transcribe()`, and below roughly
a minute only the elided upload counts. Keep sending until done (an upload that goes silent for
long enough is aborted server-side); auth, rate-limit and capacity failures can surface part-way
through the upload rather than only at the end (a malformed key at once, a key that fails deeper
checks a few seconds in), and `warm()` opens the connection but does not validate the key.

**Client-side timeout**: third argument — `client.sync.transcribe(audio, {}, { timeout: 30_000 })`
(default 60 s, kept above the server's 30 s deadline). Live requests take `SyncLiveOptions`
instead — `{ timeout, signal }`.

## Dictation (short spoken notes, optional LLM rewrite)

`client.dictation` transcribes dictation: a person speaks a short note and gets it back as
text, optionally cleaned up or reformatted by an LLM. It targets the dictation API host
(`dictation.assemblyai.com`, override with the `dictationBaseUrl` client option). There is one
connection and one shape — the live upload: audio is sent as it is spoken, the service
transcribes each speech segment as it lands, and when the speaker stops what remains is the
final segment and the LLM pass. No job id, no polling, no URL ingestion. `POST
/v1/transcribe/live` with a chunked multipart body (the `config` part before `audio`). This is
not `client.streaming`, which returns words mid-utterance; dictation returns one finished
transcript when the audio ends.

**Input**: audio still being produced — an async iterable (Node streams included), a sync
iterable, or a web `ReadableStream<Uint8Array>` — or audio already held whole: a local file path
(Node/Bun/Deno), a data URL, raw bytes (`Uint8Array`/`ArrayBuffer`), or a Blob/File, which is
sent as a single chunk over the same connection. **Not** a URL — that throws, pointing at
`client.transcripts`. Audio must be WAV or raw 16-bit PCM, ≤120 s per request.

```typescript
await client.dictation.warm(); // open the connection ahead of time (does not validate the key)

const session = client.dictation.openLive({ sample_rate: 16_000, channels: 1 });

mic.on("data", (chunk) => session.write(chunk));
mic.on("end", () => session.close());

const result = await session.result();
console.log(result.final_text);
// Or pull-style, from a stream still being written, or a file already on disk:
// await client.dictation.transcribeLive(recorder.stdout, { sample_rate: 16_000, channels: 1 });
// await client.dictation.transcribeLive("./note.wav");
```

`openLive()` starts the request immediately and is the push-style entry point for
callback-driven sources (microphone library, WebRTC track, telephony media stream). It returns a
`DictationLiveSession`: `write(chunk)` (never blocks; a late write after the session ended is
dropped rather than thrown, so a capture callback outliving teardown cannot crash the process; a
non-bytes chunk while open throws `TypeError`), `close()` (ends the audio, idempotent),
`result()` (closes if needed, then resolves with the transcript), `abort()` (drops the request —
`result()` rejects afterwards, no-op once complete), `closed`, and `stream()` for
`source.pipeTo(session.stream())`. Keep sending until done: an upload that goes silent for long
enough is aborted server-side, so finish by ending the stream, not by pausing it.

**Config** (all optional, second argument):

```typescript
const result = await client.dictation.transcribeLive(mic, {
  sample_rate: 16_000, // raw 16-bit PCM; setting either PCM field requires both; unset for WAV
  channels: 1, // 1 mono / 2 stereo
  language_codes: ["es"], // ISO 639-1; or e.g. ["en", "es"]; unset leaves the language to the server
  stt_prompt: "A doctor dictating a patient visit note.", // max 4096 chars; describes the recording
  keyterms_prompt: ["AssemblyAI", "U3-Pro"], // whitespace stripped, empties dropped, max 2048 chars total
  llm_instruction: "Format this as a SOAP note.", // max 2048 chars; follow-up LLM pass over the transcript
});
```

`stt_prompt` steers the decoder as it writes the transcript; `llm_instruction` rewrites it
afterwards. Over-cap prompts throw before the request is sent. There is no `model`, `prompt`,
`timestamps` or `conversation_context` — only these fields are sent.

**Result** (`DictationResponse`): `text` (raw transcript), `words` (`{ text, confidence }` — no
timestamps), `confidence`, `llm_response` (`string | null`, the rewrite when the LLM pass ran),
`llm_error` (`string | null`, why it failed when it did), `audio_duration_ms`, `session_id`
(record it to correlate with support), and optional `request_time_ms` / `sync_time_ms`
(transcription time excluding the LLM pass). **Show `final_text`** — derived by the SDK as
`llm_response` when there is one, `text` otherwise, so it is safe to read either way.

**Errors**: failures throw `DictationError` (a separate class from `SyncTranscriptError`) with
`.status`, a machine-readable `.errorCode` (snake_cased problem-details title: `bad_audio`,
`audio_too_large`, `capacity_exceeded`, `inference_timeout`, …), and `.retryAfter` (seconds) on
429/503. Auth, rate-limit, size and capacity failures can surface part-way through the upload
rather than only at the end.

**Pre-warming**: `await client.dictation.warm()` issues a `GET /v1/warm` to take DNS + TCP + TLS
off the critical path. It returns `true` once the socket is open — any HTTP response counts, even
a non-200 one, because it does not validate the key — and `false` on a transport failure. Call it
shortly before the request; the pooled connection idles out after a few seconds.

**Client-side timeout**: third argument, `DictationLiveOptions` — `{ timeout, signal }`.
`timeout` (default 300 000 ms) is a **total** deadline from the start of the request, spanning the
upload, the transcription and the LLM pass; the service caps audio at 120 s. `signal` cancels a
`transcribeLive()` from outside; sessions manage their own.

**Exports** from the package root: `DictationTranscriber`, `DictationLiveSession`,
`DictationError`, and the `DictationAudioInput`, `DictationConfig`, `DictationLiveOptions`,
`DictationWord` and `DictationResponse` types.

## LLM Gateway

`client.llmGateway` targets the LLM Gateway host (`llm-gateway.assemblyai.com`, override with the
`llmGatewayBaseUrl` client option). It exposes an OpenAI-compatible chat completions API and
AssemblyAI's Speech Understanding endpoints.

```typescript
const completion = await client.llmGateway.chatCompletions({
  model: "claude-haiku-4-5-20251001",
  messages: [{ role: "user", content: "Summarize this call." }],
});
console.log(completion.choices[0].message.content);

const { data: models } = await client.llmGateway.listModels();
```

`stream: true` is not supported yet — `chatCompletions()` throws before sending the request.
Speech Understanding runs curated prompt pipelines (e.g. `summarization`, `translation`) over a
transcript, referenced by `transcript_id`:

```typescript
const result = await client.llmGateway.understanding({
  transcript_id: transcript.id,
  speech_understanding: { request: { summarization: { version: "v1" } } },
});
```

Failures throw `LlmGatewayError` with `.status`, `.requestId`, and `.errors` (validation detail
strings, when present).

## Important gotchas

- **.transcribe() polls until complete** — use .submit() for fire-and-forget
- **speech_models takes an array** with fallback ordering: ["universal-3-5-pro", "universal-2"]
- **Streaming uses universal-3-5-pro** as the speech model
- **Never expose API keys client-side** — use temporary auth tokens for browser streaming
- **Live upload timeout is a total deadline** — `transcribeLive()`/`openLive()` default to 180 s covering the whole recording plus transcription (not per-response like `transcribe()`'s 60 s), and the sync API still caps audio at 120 s
- **Dictation timeout is a total 300 s deadline** — `client.dictation` spans the upload, the transcription and the LLM pass in one deadline; the service caps audio at 120 s and accepts WAV or raw 16-bit PCM only
- **Node >= 18 required**
- **Only runtime dependency**: ws (WebSocket library)
- **Multi-runtime support**: Works in Node.js, Deno, Bun, Cloudflare Workers, and browsers

## Docs

- [Full documentation](https://www.assemblyai.com/docs)
- [API reference](https://www.assemblyai.com/docs/api-reference)
- [llms-full.txt](https://www.assemblyai.com/docs/llms-full.txt?lang=typescript) (TypeScript-filtered docs for LLMs)
