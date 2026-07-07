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
- `client.streaming.transcriber(params)` — Create a real-time streaming session

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

## Important gotchas

- **.transcribe() polls until complete** — use .submit() for fire-and-forget
- **speech_models takes an array** with fallback ordering: ["universal-3-5-pro", "universal-2"]
- **Streaming uses universal-3-5-pro** as the speech model
- **Never expose API keys client-side** — use temporary auth tokens for browser streaming
- **Node >= 18 required**
- **Only runtime dependency**: ws (WebSocket library)
- **Multi-runtime support**: Works in Node.js, Deno, Bun, Cloudflare Workers, and browsers

## Docs

- [Full documentation](https://www.assemblyai.com/docs)
- [API reference](https://www.assemblyai.com/docs/api-reference)
- [llms-full.txt](https://www.assemblyai.com/docs/llms-full.txt?lang=typescript) (TypeScript-filtered docs for LLMs)
