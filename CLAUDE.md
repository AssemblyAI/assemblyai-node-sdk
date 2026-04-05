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
  speech_models: ["universal-3-pro", "universal-2"],
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
  speech_models: ["universal-3-pro", "universal-2"],
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
  speechModel: "u3-rt-pro",
  sampleRate: 16_000,
});

transcriber.on("turn", (turn) => {
  console.log(turn.text);
});

await transcriber.connect();
// Send audio chunks: transcriber.sendAudio(chunk)
await transcriber.close();
```

**Subtitles:**
```typescript
const srt = await client.transcripts.subtitles(id, "srt");
const vtt = await client.transcripts.subtitles(id, "vtt");
```

## Important gotchas

- **`.transcribe()` polls until complete** — use `.submit()` for fire-and-forget
- **`speech_models` takes an array** with fallback ordering: `["universal-3-pro", "universal-2"]`
- **Streaming uses `u3-rt-pro`** as the speech model
- **Never expose API keys client-side** — use temporary auth tokens for browser streaming
- **Node >= 18 required**
- **Only runtime dependency**: `ws` (WebSocket library)
- **Multi-runtime support**: Works in Node.js, Deno, Bun, Cloudflare Workers, and browsers

## Docs

- [Full documentation](https://www.assemblyai.com/docs)
- [API reference](https://www.assemblyai.com/docs/api-reference)
- [llms-full.txt](https://www.assemblyai.com/docs/llms-full.txt?lang=typescript) (TypeScript-filtered docs for LLMs)
