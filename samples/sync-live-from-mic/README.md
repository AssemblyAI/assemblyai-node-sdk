# Transcribe live microphone audio with the sync API in TypeScript

This sample records from your microphone and transcribes it with the sync API's
live upload (`client.sync.openLive()`). The audio uploads while you are still
speaking, so when you stop, only the final speech segment is left to transcribe.

Unlike Streaming Speech-to-Text, this does not return words mid-utterance: you
get one finished transcript when the recording ends. Audio is capped at 120
seconds.

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

Run the sample, speak, then press Enter to stop:

```bash
npm run start
```

Credits: `sox.ts` is adapted from the [node-record-lpcm16](https://github.com/gillesdemey/node-record-lpcm16) project by Gilles De Mey.
