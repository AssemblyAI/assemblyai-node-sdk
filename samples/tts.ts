/**
 * Text-to-Speech: a WAV file over HTTP, then a voice-agent style session
 * that speaks a reply sentence by sentence and is interrupted once.
 */
import { writeFileSync } from "fs"
import { AssemblyAI, TextToSpeechError } from "assemblyai"

const client = new AssemblyAI({ apiKey: "YOUR_API_KEY" })

async function main() {
  // One request, the whole audio
  const response = await client.tts.synthesize({
    text: "Hello from AssemblyAI.",
    voice_id: "aai-jane",
    container: "wav",
  })
  writeFileSync("hello.wav", response.audio)
  console.log(
    `hello.wav: ${response.audioDurationMs} ms, ${response.billedCharacters} characters`,
  )

  // A session: text as it is written, audio as it is generated
  const session = client.tts.session({ voiceId: "aai-alba" })
  await session.connect()
  const reply = [
    "Sure, I can help with that.",
    "Your appointment is on Tuesday at three in the afternoon.",
    "Is there anything else?",
  ]
  for (const [index, sentence] of reply.entries()) {
    let bytes = 0
    for await (const chunk of session.speak(sentence)) {
      bytes += chunk.byteLength
      if (index === 1 && bytes > 48_000) {
        session.cancel() // the user interrupted after a second of audio
        break
      }
    }
    console.log(`sentence ${index + 1}: ${bytes} bytes of 24 kHz PCM`)
  }
  const summary = await session.close()
  console.log(`spoke ${summary?.audio_duration_seconds} s in total`)
}

main().catch((error) => {
  if (error instanceof TextToSpeechError) {
    console.error(error.errorCode, error.param, error.message)
  } else {
    throw error
  }
})
