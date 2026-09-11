<img src="https://github.com/AssemblyAI/assemblyai-node-sdk/blob/main/assemblyai.png?raw=true" width="500"/>

---

[![npm](https://img.shields.io/npm/v/assemblyai)](https://www.npmjs.com/package/assemblyai)
[![Test](https://github.com/AssemblyAI/assemblyai-node-sdk/actions/workflows/test.yml/badge.svg)](https://github.com/AssemblyAI/assemblyai-node-sdk/actions/workflows/test.yml)
[![GitHub License](https://img.shields.io/github/license/AssemblyAI/assemblyai-node-sdk)](https://github.com/AssemblyAI/assemblyai-node-sdk/blob/main/LICENSE)
[![AssemblyAI Twitter](https://img.shields.io/twitter/follow/AssemblyAI?label=%40AssemblyAI&style=social)](https://twitter.com/AssemblyAI)
[![AssemblyAI YouTube](https://img.shields.io/youtube/channel/subscribers/UCtatfZMf-8EkIwASXM4ts0A)](https://www.youtube.com/@AssemblyAI)
[![Discord](https://img.shields.io/discord/875120158014853141?logo=discord&label=Discord&link=https%3A%2F%2Fdiscord.com%2Fchannels%2F875120158014853141&style=social)
](https://assembly.ai/discord)

# AssemblyAI JavaScript SDK

The AssemblyAI JavaScript SDK provides an easy-to-use interface for interacting with the AssemblyAI API,
which supports async and streaming transcription.
It is written primarily for Node.js in TypeScript with all types exported, but also [compatible with other runtimes](./docs/compat.md).

## Claude Code

This repository includes a [`CLAUDE.md`](CLAUDE.md) file that provides context to Claude Code about this SDK — key APIs, common patterns, and gotchas. When you open this repo in Claude Code, it automatically reads this file to give better assistance.

## Using with AI coding agents

If you're integrating this SDK with Claude Code, Cursor, Copilot, or another AI coding assistant, give your agent current API context so it doesn't generate code against outdated model names or parameters.

The most effective option is project instructions. Add this to your `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, or equivalent agent instructions file:

> Always fetch https://assemblyai.com/docs/llms.txt before writing AssemblyAI code. The API has changed, do not rely on memorized parameter names.

For on-demand documentation lookups during a session, connect the AssemblyAI docs MCP server:

```
claude mcp add assemblyai-docs --transport http https://mcp.assemblyai.com/docs
```

For deep SDK context in Claude Code specifically, install the [AssemblyAI skill](https://github.com/AssemblyAI/assemblyai-skill):

```
claude install-skill https://github.com/AssemblyAI/assemblyai-skill
```

See [Coding agent prompts](https://www.assemblyai.com/docs/coding-agent-prompts) for Cursor setup, MCP tool details, and tips for best results.

## Documentation

Visit the [AssemblyAI documentation](https://www.assemblyai.com/docs) for step-by-step instructions and a lot more details about our AI models and API.
Explore the [SDK API reference](https://assemblyai.github.io/assemblyai-node-sdk/) for more details on the SDK types, functions, and classes.

## Quickstart

Install the AssemblyAI SDK using your preferred package manager:

```bash
npm install assemblyai
```

```bash
yarn add assemblyai
```

```bash
pnpm add assemblyai
```

```bash
bun add assemblyai
```

Then, import the `assemblyai` module and create an AssemblyAI object with your API key:

```js
import { AssemblyAI } from "assemblyai";

const baseUrl = "https://api.assemblyai.com";

const client = new AssemblyAI({
  apiKey: "YOUR_API_KEY",
  baseUrl: baseUrl,
});
```

You can now use the `client` object to interact with the AssemblyAI API.

### Using a CDN

You can use automatic CDNs like [UNPKG](https://unpkg.com/) to load the library from a script tag.

- Replace `:version` with the desired version or `latest`.
- Remove `.min` to load the non-minified version.
- Remove `.streaming` to load the entire SDK. Keep `.streaming` to load the Streaming STT specific version.

```html
<!-- Unminified full SDK -->
<script src="https://www.unpkg.com/assemblyai@:version/dist/assemblyai.umd.js"></script>
<!-- Minified full SDK -->
<script src="https://www.unpkg.com/assemblyai@:version/dist/assemblyai.umd.min.js"></script>
<!-- Unminified Streaming STT only -->
<script src="https://www.unpkg.com/assemblyai@:version/dist/assemblyai.streaming.umd.js"></script>
<!-- Minified Streaming STT only -->
<script src="https://www.unpkg.com/assemblyai@:version/dist/assemblyai.streaming.umd.min.js"></script>
```

The script creates a global `assemblyai` variable containing all the services.
Here's how you create a `StreamingTranscriber` object.

```js
const { StreamingTranscriber } = assemblyai;
const transcriber = new StreamingTranscriber({
  token: "[GENERATE TEMPORARY AUTH TOKEN IN YOUR API]",
  ...
});
```

For type support in your IDE, see [Reference types from JavaScript](./docs/reference-types-from-js.md).

## Speech-To-Text

### Transcribe audio and video files

<details open>
  <summary>Transcribe an audio file with a public URL</summary>

When you create a transcript, you can either pass in a URL to an audio file or upload a file directly.

```js
// Transcribe file at remote URL
const audioFile = "https://assembly.ai/sports_injuries.mp3";

const params = {
  audio: audioFile,
  speech_models: ["universal-3-5-pro", "universal-2"],
  language_detection: true,
};

const run = async () => {
  const transcript = await client.transcripts.transcribe(params);
  console.log(transcript.text);
};

run();
```

> [!NOTE]
> You can also pass a local file path, a stream, or a buffer as the `audio` property.

`transcribe` queues a transcription job and polls it until the `status` is `completed` or `error`.

If you don't want to wait until the transcript is ready, you can use `submit`:

```js
let transcript = await client.transcripts.submit({
  audio: "https://assembly.ai/espn.m4a",
  speech_models: ["universal-3-5-pro", "universal-2"],
  language_detection: true,
});
```

</details>

<details>
  <summary>Transcribe a local audio file</summary>

When you create a transcript, you can either pass in a URL to an audio file or upload a file directly.

```js
// Upload a file via local path and transcribe
let transcript = await client.transcripts.transcribe({
  audio: "./news.mp4",
  speech_models: ["universal-3-5-pro", "universal-2"],
  language_detection: true,
});
```

> **Note:**
> You can also pass a file URL, a stream, or a buffer as the `audio` property.

`transcribe` queues a transcription job and polls it until the `status` is `completed` or `error`.

If you don't want to wait until the transcript is ready, you can use `submit`:

```js
let transcript = await client.transcripts.submit({
  audio: "./news.mp4",
  speech_models: ["universal-3-5-pro", "universal-2"],
  language_detection: true,
});
```

</details>

<details>
  <summary>Enable additional Speech Understanding models</summary>

You can extract even more insights from the audio by enabling any of our Speech Understanding models using _transcription options_.
For example, here's how to enable [Speaker diarization](https://www.assemblyai.com/docs/pre-recorded-audio/speaker-diarization) model to detect who said what.

```js
import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({
  apiKey: "<YOUR_API_KEY>",
});

const audioFile = "https://assembly.ai/wildfires.mp3";

const params = {
  audio: audioFile,
  speech_models: ["universal-3-5-pro", "universal-2"],
  language_detection: true,
  speaker_labels: true,
};

const run = async () => {
  const transcript = await client.transcripts.transcribe(params);

  for (const utterance of transcript.utterances!) {
    console.log(`Speaker ${utterance.speaker}: ${utterance.text}`);
  }
};

run();
```

</details>

<details>
  <summary>Get a transcript</summary>

This will return the transcript object in its current state. If the transcript is still processing, the `status` field will be `queued` or `processing`. Once the transcript is complete, the `status` field will be `completed`.

```js
const transcript = await client.transcripts.get(transcript.id);
```

If you created a transcript using `.submit()`, you can still poll until the transcript `status` is `completed` or `error` using `.waitUntilReady()`:

```js
const transcript = await client.transcripts.waitUntilReady(transcript.id, {
  // How frequently the transcript is polled in ms. Defaults to 3000.
  pollingInterval: 1000,
  // How long to wait in ms until the "Polling timeout" error is thrown. Defaults to infinite (-1).
  pollingTimeout: 5000,
});
```

</details>
<details>
  <summary>Get sentences and paragraphs</summary>

```js
const sentences = await client.transcripts.sentences(transcript.id);
const { paragraphs } = await client.transcripts.paragraphs(transcript.id);

for (const paragraph of paragraphs) {
  console.log(paragraph.text);
}

for (const sentence of sentences) {
  console.log(sentence.text);
}
```

</details>

<details>
  <summary>Get subtitles</summary>

```js
const charsPerCaption = 32;
let srt = await client.transcripts.subtitles(transcript.id, "srt");
srt = await client.transcripts.subtitles(transcript.id, "srt", charsPerCaption);

let vtt = await client.transcripts.subtitles(transcript.id, "vtt");
vtt = await client.transcripts.subtitles(transcript.id, "vtt", charsPerCaption);
```

</details>
<details>
  <summary>List transcripts</summary>

This will return a page of transcripts you created.

```js
const page = await client.transcripts.list();
```

You can also paginate over all pages.

```typescript
let previousPageUrl: string | null = null;
do {
  const page = await client.transcripts.list(previousPageUrl);
  previousPageUrl = page.page_details.prev_url;
} while (previousPageUrl !== null);
```

> [!NOTE]
> To paginate over all pages, you need to use the `page.page_details.prev_url`
> because the transcripts are returned in descending order by creation date and time.
> The first page is are the most recent transcript, and each "previous" page are older transcripts.

</details>

<details>
<summary>Delete a transcript</summary>

```js
const res = await client.transcripts.delete(transcript.id);
```

</details>

### Transcribe audio synchronously

`client.sync` posts a whole audio file and returns the finished transcript in one
round trip — no job id, no polling — or uploads the audio live, as it is still
being recorded (`transcribeLive()` / `openLive()`). Use it for short clips where
you want the answer inline; use `client.transcripts` for long-form audio, URLs,
or the rich audio-intelligence features the sync API doesn't expose.

```typescript
const result = await client.sync.transcribe("./call.wav");
console.log(result.text, result.session_id);
```

The input can be a local file path, raw audio bytes, a Blob, or a readable
stream — but not a URL.

<details>
<summary>Configure the transcription</summary>

```typescript
const result = await client.sync.transcribe("./call.wav", {
  prompt: "Transcribe verbatim. Preserve disfluencies.", // max 4096 chars
  keyterms_prompt: ["AssemblyAI", "Lemur"], // max 2048 chars total
  language_codes: ["es"], // or e.g. ["en", "es"] for multilingual; defaults to English
  conversation_context: [
    // prior turns, oldest first
    "I'd like to book a flight to Denver.",
    "Sure, what date were you thinking?",
  ],
});
```

Raw S16LE PCM audio needs `sample_rate` and `channels`; WAV reads them from its
header.

```typescript
const result = await client.sync.transcribe(rawPcmBytes, {
  sample_rate: 16_000,
  channels: 1,
});
```

</details>

<details>
<summary>Get word timestamps</summary>

Word timestamps are opt-in. By default each word in `result.words` carries
`text` and `confidence` only — `start`/`end` are absent. Set `timestamps: true`
to get accurate per-word timings at a small latency cost.

```typescript
const result = await client.sync.transcribe("./call.wav", {
  timestamps: true,
});
for (const word of result.words) {
  console.log(word.text, word.start, word.end); // milliseconds
}
```

</details>

<details>
<summary>Pre-warm the connection</summary>

The sync API is a single request/response, so a `transcribe()` that connects on
demand pays the full DNS + TCP + TLS handshake on the critical path. Call `warm()`
as soon as you know audio is coming — for example while it is still being
recorded — so the next `transcribe()` reuses the open connection.

```typescript
await client.sync.warm(); // fire as recording starts
const audio = await recordUntilDone();
const result = await client.sync.transcribe(audio); // reuses the hot connection
```

</details>

<details>
<summary>Transcribe live audio as it is recorded (`openLive()`)</summary>

`openLive()` starts the request before the audio exists and uploads chunks as
they arrive, so authorization, the upload and every speech segment but the last
resolve while you are still recording. What is left to wait for once the speaker
stops is the final segment. It is built for callback-driven sources: a
microphone library, a WebRTC track, a telephony media stream.

```typescript
import { spawn } from "node:child_process";
import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
const sampleRate = 16_000;

// The SoX recorder the samples use (see samples/sync-live-from-mic), capturing
// raw 16-bit mono PCM on stdout.
const recorder = spawn("sox", [
  "--default-device",
  "--no-show-progress",
  "--rate",
  String(sampleRate),
  "--channels",
  "1",
  "--encoding",
  "signed-integer",
  "--bits",
  "16",
  "--type",
  "raw",
  "-",
]);

await client.sync.warm(); // open the connection ahead of time

// The request starts here. Raw PCM carries no header, so the sample rate and
// channel count go in the config.
const session = client.sync.openLive({ sample_rate: sampleRate, channels: 1 });

// write() never blocks, so it is safe to call from a capture callback.
recorder.stdout.on("data", (chunk) => session.write(chunk));
recorder.stdout.on("end", () => session.close()); // ends the audio

process.on("SIGINT", () => recorder.kill()); // stop speaking, stop recording

const result = await session.result(); // closes if needed, then waits
console.log(result.text);
```

`result()` rejects with a `SyncTranscriptError` when the server rejects the
request. To drop the upload instead — the user cancelled, the call ended — use
`await session.abort()`; `result()` rejects afterwards. `session.closed` reports
whether the audio has ended, and `session.stream()` returns a `WritableStream`
so a web stream of audio can be piped straight in (`source.pipeTo(session.stream())`),
closing the session when it closes.

> This is not the streaming API. `client.streaming` returns words while the
> speaker is still talking; a live sync upload returns one finished transcript
> when the audio ends. The caveats below apply to `openLive()` unchanged.

</details>

<details>
<summary>Transcribe live audio from a stream (`transcribeLive()`)</summary>

`transcribeLive()` is the pull-style counterpart of `openLive()`, for sources
that already are streams: an async iterable (Node streams included), a sync
iterable, or a web `ReadableStream<Uint8Array>`. It takes the same config as
`transcribe()` and returns the same transcript.

A file already on disk is the wrong source. Streaming it is **slower** than
`transcribe()`, which uploads it in one piece, and the live route rejects bytes,
a Blob or a path by name:

```typescript
import { createReadStream } from "node:fs";

// Don't: the audio already exists, so there is nothing to overlap with.
await client.sync.transcribeLive(createReadStream("./call.wav"));

// Do: transcribe() uploads the whole file at once.
await client.sync.transcribe("./call.wav");
```

A recorder process, or any producer that has not finished yet, is the right
source:

```typescript
const recorder = spawn("sox", soxArgs); // still recording
const controller = new AbortController();

const result = await client.sync.transcribeLive(
  recorder.stdout, // a Node Readable; a web ReadableStream works too
  { sample_rate: 16_000, channels: 1 },
  { timeout: 180_000, signal: controller.signal },
);
console.log(result.text);
```

`options.timeout` (default 180 000 ms) is a **total** deadline spanning the
whole upload, unlike `transcribe()`'s 60 s, so it has to exceed the length of
the recording as well as the transcription. `options.signal` drops the request
from outside, the way `abort()` does for a session.

Caveats, for both live entry points:

- The win is overlapping the upload with the recording, so it needs audio that
  is genuinely still being produced, and enough of it to have segments to
  release early — below roughly a minute only the elided upload counts. On a
  paced 7-second clip, the wait after the speaker stopped fell from ~380 ms to
  ~180 ms
- The same 120 s audio cap applies
- Keep sending until you are done: an upload that goes silent for long enough
  is aborted server-side. Finish by ending the stream (or `close()`), not by
  pausing it
- Auth, rate-limit and capacity failures can surface part-way through the
  upload rather than only at the end, as a `SyncTranscriptError` from
  `result()` (or from the awaited `transcribeLive()`). A malformed key is
  rejected at once; a key that fails deeper checks can surface a few seconds
  in, once the server reaches its first segment
- Raw PCM needs `sample_rate` and `channels` in the config; WAV reads them from
  its header

</details>

<details>
<summary>Handle errors</summary>

Failures throw a `SyncTranscriptError` with the HTTP `status`, a machine-readable
`errorCode` (`bad_audio`, `audio_too_large`, `capacity_exceeded`, …), and
`retryAfter` (seconds) on 429/503 responses.

```typescript
import { SyncTranscriptError } from "assemblyai";

try {
  const result = await client.sync.transcribe("./call.wav");
} catch (error) {
  if (error instanceof SyncTranscriptError) {
    console.error(error.status, error.errorCode, error.retryAfter);
  }
}
```

</details>

### Dictation

`client.dictation` transcribes short spoken notes: a person speaks, the audio
uploads as it is spoken, and when they stop you get one finished transcript
back — optionally cleaned up or reformatted by an LLM. There is no job id and no
polling, and the service takes audio rather than URLs. It targets the dictation
API host (`https://dictation.assemblyai.com`, override with the
`dictationBaseUrl` client option).

```typescript
const result = await client.dictation.transcribeLive(micStream, {
  sample_rate: 16_000,
  channels: 1,
});
console.log(result.final_text, result.session_id);
```

`result.final_text` is the one to show the user: the LLM rewrite when an
`llm_instruction` ran, the raw transcript otherwise. `result.text` always holds
the raw transcript. Audio must be WAV or raw 16-bit PCM, up to 120 seconds per
request.

> This is not the streaming API. `client.streaming` returns words while the
> speaker is still talking; dictation returns one finished transcript when the
> audio ends.

<details open>
<summary>Dictate from a microphone (`openLive()`)</summary>

`openLive()` starts the request immediately and takes audio pushed into it, so
it suits callback-driven sources: a microphone library, a WebRTC track, a
telephony media stream.

```typescript
import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

await client.dictation.warm(); // open the connection ahead of time

// The request starts here. Raw PCM carries no header, so the sample rate and
// channel count go in the config.
const session = client.dictation.openLive({
  sample_rate: 16_000,
  channels: 1,
});

// write() never blocks, so it is safe to call from a capture callback.
mic.on("data", (chunk) => session.write(chunk));
mic.on("end", () => session.close()); // ends the audio

const result = await session.result(); // closes if needed, then waits
console.log(result.final_text);
```

`result()` rejects with a `DictationError` when the server rejects the request.
To drop the request instead — the speaker cancelled, the call ended — use
`session.abort()`; `result()` rejects afterwards. `session.closed` reports
whether the audio has ended, and `session.stream()` returns a `WritableStream`
so a web stream of audio can be piped straight in
(`source.pipeTo(session.stream())`), closing the session when it closes.

A late `write()` after the session ended is dropped rather than thrown, so a
capture callback that outlives teardown cannot crash the process. Writing
something other than bytes while the session is open throws a `TypeError`.

</details>

<details>
<summary>Transcribe from a stream or a file (`transcribeLive()`)</summary>

`transcribeLive()` is the pull-style entry point. It takes audio that is still
being produced — an async iterable (Node streams included), a sync iterable, or
a web `ReadableStream<Uint8Array>`:

```typescript
const recorder = spawn("sox", soxArgs); // still recording
const controller = new AbortController();

const result = await client.dictation.transcribeLive(
  recorder.stdout, // a Node Readable; a web ReadableStream works too
  { sample_rate: 16_000, channels: 1 },
  { timeout: 300_000, signal: controller.signal },
);
console.log(result.final_text);
```

Audio already held whole works too — a local file path, a data URL, raw bytes
(`Uint8Array`/`ArrayBuffer`), or a Blob/File — and is sent as a single chunk
over the same connection:

```typescript
const result = await client.dictation.transcribeLive("./note.wav");
console.log(result.final_text);
```

A URL is rejected with an error pointing at `client.transcripts`, which is where
URL ingestion lives.

`options.timeout` (default 300 000 ms) is a **total** deadline from the start of
the request, spanning the upload, the transcription and the LLM pass; the
service caps the audio itself at 120 seconds. `options.signal` drops the request
from outside, the way `abort()` does for a session.

Caveats, for both entry points:

- Keep producing audio until you are done: an upload that goes silent for long
  enough is aborted server-side. Finish by ending the stream (or `close()`), not
  by pausing it
- Raw PCM needs `sample_rate` and `channels` in the config; WAV reads them from
  its header
- Auth, rate-limit, size and capacity failures can surface part-way through the
  upload rather than only at the end, as a `DictationError`

</details>

<details>
<summary>Rewrite the transcript with an LLM</summary>

`llm_instruction` runs a follow-up LLM pass over the transcript. The rewrite
comes back as `llm_response`; the raw transcript stays in `text`, and
`final_text` is whichever of the two you should show.

```typescript
const result = await client.dictation.transcribeLive(micStream, {
  llm_instruction: "Format this as a SOAP note.", // max 2048 chars
});

console.log(result.text); // what the speaker said
console.log(result.llm_response); // the rewrite, or null if no instruction ran
console.log(result.final_text); // llm_response when there is one, text otherwise
```

When the LLM pass fails, `llm_response` is `null` and `llm_error` says why — the
transcript itself still comes back.

</details>

<details>
<summary>Configure the dictation</summary>

```typescript
const result = await client.dictation.transcribeLive(micStream, {
  sample_rate: 16_000, // raw 16-bit PCM only; required together with channels
  channels: 1, // 1 mono, 2 stereo; leave both unset for WAV
  language_codes: ["es"], // ISO 639-1; or e.g. ["en", "es"]; defaults to the server's choice
  stt_prompt: "A doctor dictating a patient visit note.", // max 4096 chars
  keyterms_prompt: ["AssemblyAI", "Universal-3"], // max 2048 chars total
  llm_instruction: "Format this as a SOAP note.", // max 2048 chars
});
```

`stt_prompt` describes the situation the audio was recorded in and steers the
decoder as it writes the transcript. Setting either PCM field marks the audio as
raw 16-bit PCM, and both are then required. Prompts over their cap throw before
the request is sent.

</details>

<details>
<summary>Pre-warm the connection</summary>

A request that connects on demand pays the full DNS + TCP + TLS handshake on the
critical path. Call `warm()` shortly before you expect audio — the pooled
connection idles out after a few seconds — so the request reuses the open
socket.

```typescript
const ready = await client.dictation.warm(); // true once the socket is open
```

`warm()` returns `true` for any HTTP response, even a non-200 one: it opens the
connection, it does not validate the API key. It returns `false` on a transport
failure.

</details>

<details>
<summary>Handle errors</summary>

Failures throw a `DictationError` with the HTTP `status`, a machine-readable
`errorCode` (`bad_audio`, `audio_too_large`, `capacity_exceeded`,
`inference_timeout`, …), and `retryAfter` (seconds) on 429/503 responses.

```typescript
import { DictationError } from "assemblyai";

try {
  const result = await client.dictation.transcribeLive(micStream);
} catch (error) {
  if (error instanceof DictationError) {
    console.error(error.status, error.errorCode, error.retryAfter);
  }
}
```

Record `result.session_id` from successful requests so a support conversation
can be correlated with the request.

</details>

### Transcribe streaming audio

Refer to [AssemblyAI's streaming documentation](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio) for full code examples.

Create the streaming transcriber.

```typescript
const transcriber = client.streaming.transcriber({
  speechModel: "universal-3-5-pro",
  sampleRate: 16_000,
});
```

> [!WARNING]
> Storing your API key in client-facing applications exposes your API key.
> Generate a temporary auth token on the server and pass it to your client.
> _Server code_:
>
> ```typescript
> const token = await client.streaming.createTemporaryToken({
>   expires_in_seconds = 60,
> });
> // TODO: return token to client
> ```
>
> _Client code_:
>
> ```typescript
> import { StreamingTranscriber } from "assemblyai";
> // TODO: implement getToken to retrieve token from server
> const token = await getToken();
> const transcriber = new StreamingTranscriber({
>   token,
> });
> ```

You can configure the following events.

<!-- prettier-ignore -->
```typescript
transcriber.on("open", ({ id, expires_at }) => console.log('Session ID:', id, 'Expires at:', expires_at));
transcriber.on("close", (code: number, reason: string) => console.log('Closed', code, reason));
transcriber.on("turn", ({ transcript }) => console.log('Transcript:', transcript));
transcriber.on("error", (error: Error) => console.error('Error', error));
```

After configuring your events, connect to the server.

```typescript
await transcriber.connect();
```

Send audio data via chunks.

```typescript
// Pseudo code for getting audio
getAudio((chunk) => {
  transcriber.sendAudio(chunk);
});
```

Or send audio data via a stream:

```typescript
audioStream.pipeTo(transcriber.stream());
```

Close the connection when you're finished.

```typescript
await transcriber.close();
```

## Contributing

If you want to contribute to the JavaScript SDK, follow the guidelines in [CONTRIBUTING.md](./CONTRIBUTING.md).
