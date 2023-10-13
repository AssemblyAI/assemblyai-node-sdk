<img src="https://github.com/AssemblyAI/assemblyai-node-sdk/blob/main/assemblyai.png?raw=true" width="500"/>

---

[![npm](https://img.shields.io/npm/v/assemblyai)](https://www.npmjs.com/package/assemblyai)
[![Test](https://github.com/AssemblyAI/assemblyai-node-sdk/actions/workflows/test.yml/badge.svg)](https://github.com/AssemblyAI/assemblyai-node-sdk/actions/workflows/test.yml)
[![GitHub License](https://img.shields.io/github/license/AssemblyAI/assemblyai-node-sdk)](https://github.com/AssemblyAI/assemblyai-node-sdk/blob/master/LICENSE)
[![AssemblyAI Twitter](https://img.shields.io/twitter/follow/AssemblyAI?label=%40AssemblyAI&style=social)](https://twitter.com/AssemblyAI)
[![AssemblyAI YouTube](https://img.shields.io/youtube/channel/subscribers/UCtatfZMf-8EkIwASXM4ts0A)](https://www.youtube.com/@AssemblyAI)
[![Discord](https://img.shields.io/discord/875120158014853141?logo=discord&label=Discord&link=https%3A%2F%2Fdiscord.com%2Fchannels%2F875120158014853141&style=social)
](https://discord.gg/5aQNZyq3)

# AssemblyAI Node.js SDK

The AssemblyAI Node.js SDK provides an easy-to-use interface for interacting with the AssemblyAI API,
which supports async and real-time transcription, as well as the latest LeMUR models.

## Installation

You can install the AssemblyAI SDK by running:

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

# Usage

Import the AssemblyAI package and create an AssemblyAI object with your API key:

```javascript
import AssemblyAI from "assemblyai";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
})
```

You can now use the `client` object to interact with the AssemblyAI API.

## Create a transcript

When you create a transcript, you can either pass in a URL to an audio file, or upload a file directly.

```javascript
// Using a remote URL
const transcript = await client.transcripts.create({
  audio_url: 'https://storage.googleapis.com/aai-web-samples/espn-bears.m4a',
})
```

```javascript
// Uploading a file
const transcript = await client.transcripts.create({
  audio_url: './news.mp4',
})
```

By default, when you create a transcript, it'll be polled until the status is `completed` or `error`.
You can configure whether to poll, the polling interval, and polling timeout using these options:

```javascript
const transcript = await client.transcripts.create({
  audio_url: 'https://storage.googleapis.com/aai-web-samples/espn-bears.m4a',
},
{
  // Enable or disable polling. Defaults to true.
  poll: true,
  // How frequently the transcript is polled in ms. Defaults to 3000.
  pollingInterval: 1000,
  // How long to wait in ms until the "Polling timeout" error is thrown. Defaults to 180000.
  pollingTimeout: 5000,
})
```

## Get a transcript

This will return the transcript object in its current state. If the transcript is still processing, the `status` field will be `queued` or `processing`. Once the transcript is complete, the `status` field will be `completed`.

```javascript
const transcript = await client.transcripts.get(transcript.id)
```

## List transcripts

This will return a paged list of transcripts that you have transcript.

```javascript
const page = await client.transcripts.list()
```

You can also paginate over all pages.

```typescript
let nextPageUrl: string | null = null;
do {
  const page = await client.transcripts.list(nextPageUrl)
  nextPageUrl = page.page_details.next_url
} while(nextPageUrl !== null)
```

## Delete a transcript

```javascript
const res = await client.transcripts.delete(transcript.id)
```

## Use LeMUR

Call [LeMUR endpoints](https://www.assemblyai.com/docs/API%20reference/lemur) to summarize, ask questions, generate action items, or run a custom task.

Custom Summary:
```javascript
const { response } = await client.lemur.summary({
  transcript_ids: ['0d295578-8c75-421a-885a-2c487f188927'],
  answer_format: 'one sentence',
  context: {
    speakers: ['Alex', 'Bob'],
  }
})
```

Question & Answer:
```javascript
const { response } = await client.lemur.questionAnswer({
  transcript_ids: ['0d295578-8c75-421a-885a-2c487f188927'],
  questions: [
    {
      question: 'What are they discussing?',
      answer_format: 'text',
    }
  ]
})
```

Action Items:
```javascript
const { response } = await client.lemur.actionItems({
  transcript_ids: ['0d295578-8c75-421a-885a-2c487f188927'],
})
```

Custom Task:
```javascript
const { response } = await client.lemur.task({
  transcript_ids: ['0d295578-8c75-421a-885a-2c487f188927'],
  prompt: 'Write a haiku about this conversation.',
})
```

## Transcribe in real time

Create the real-time service.

```typescript
const rt = client.realtime.createService();
```

You can also pass in the following options.

```typescript
const rt = client.realtime.createService({
  realtimeUrl: 'wss://localhost/override',
  apiKey: process.env.ASSEMBLYAI_API_KEY // The API key passed to `AssemblyAI` will be used by default,
  sampleRate: 16_000,
  wordBoost: ['foo', 'bar']
});
```

You can also generate a temporary auth token for real-time.

```typescript
const token = await client.realtime.createTemporaryToken({ expires_in = 60 });
const rt = client.realtime.createService({
  token: token
});
```

> [!WARNING]
> Storing your API key in client-facing applications exposes your API key.
> Generate a temporary auth token on the server and pass it to your client.

You can configure the following events.

```typescript
rt.on("open", ({ sessionId, expiresAt }) => console.log('Session ID:', sessionId, 'Expires at:', expiresAt));
rt.on("close", (code: number, reason: string) => console.log('Closed', code, reason));
rt.on("transcript", (transcript: TranscriptMessage) => console.log('Transcript:', transcript));
rt.on("transcript.partial", (transcript: PartialTranscriptMessage) => console.log('Partial transcript:', transcript));
rt.on("transcript.final", (transcript: FinalTranscriptMessage) => console.log('Final transcript:', transcript));
rt.on("error", (error: Error) => console.error('Error', error));
```

After configuring your events, connect to the server.

```typescript
await rt.connect();
```

Send audio data via chunks.

```typescript
// Pseudo code for getting audio
getAudio((chunk) => {
  rt.sendAudio(chunk);
});
```
Or send audio data via a stream by piping to the realtime stream.

```typescript
audioStream.pipe(rt.stream());
```

Close the connection when you're finished.

```typescript
await rt.close();
```

# Tests

To run the test suite, first install the dependencies, then run `pnpm test`:

```bash
pnpm install
pnpm test
```
