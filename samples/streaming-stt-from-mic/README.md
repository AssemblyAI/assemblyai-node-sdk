# Transcribe streaming audio from a microphone in TypeScript

This sample lets you transcribe audio from your microphone in real time using AssemblyAI Streaming Speech-to-Text.
For step-by-step instructions on how to build this sample yourself, see [Transcribe streaming audio from a microphone in TypeScript](https://www.assemblyai.com/docs/getting-started/transcribe-streaming-audio-from-a-microphone/typescript).

To run the sample, you'll need the following:

- [Node.js](https://nodejs.org/)
- [SoX](https://sourceforge.net/projects/sox/)
- An AssemblyAI account with a credit card set up

Install the dependencies:

```bash
npm install
```

Configure the `ASSEMBLYAI_API_KEY` environment variable in your shell, or create a `.env` file with the following contents and replace `[YOUR_ASSEMBLYAI_API_KEY]` with your API key:

```plaintext
ASSEMBLYAI_API_KEY=[YOUR_ASSEMBLYAI_API_KEY]
```

Run the sample:

```bash
npm run start
```

Credits: `sox.ts` is adapted from the [node-record-lpcm16](https://github.com/gillesdemey/node-record-lpcm16) project by Gilles De Mey.
