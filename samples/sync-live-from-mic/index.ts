// Transcribe microphone audio with the sync API's live upload: the recording
// uploads while you speak, so when you stop only the final speech segment is
// left to transcribe. Records until you press Enter, then prints the
// transcript. Audio is capped at 120 seconds.

import "dotenv/config"
import { AssemblyAI } from "assemblyai"
import { SoxRecording } from "./sox.js"

const SAMPLE_RATE = 16_000

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
})

// Open the connection before there is any audio, so the handshake is not on
// the critical path once the recording starts.
await client.sync.warm()

console.log("Recording — speak, then press Enter to stop.")
const recording = new SoxRecording({
  channels: 1,
  sampleRate: SAMPLE_RATE,
  audioType: "raw", // raw S16LE PCM
})

// The request starts here. Raw PCM carries no header, so the sample rate and
// channel count go in the config.
const session = client.sync.openLive({
  sample_rate: SAMPLE_RATE,
  channels: 1,
})

// Hand each captured chunk to the upload. write() never blocks, so it is safe
// to call from an audio library's capture callback.
const reader = recording.stream().getReader()
const uploading = (async () => {
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    session.write(value)
  }
})()

await new Promise<void>((resolve) =>
  process.stdin.once("data", () => resolve()),
)

console.log("Stopping recording")
recording.stop()
await uploading.catch(() => {}) // SoX was killed; keep the audio we sent
session.close() // ends the audio; the server transcribes what it received

// session.abort() instead would drop the request without a transcript.
const result = await session.result()
console.log()
console.log("Transcript:", result.text)

process.exit(0)
