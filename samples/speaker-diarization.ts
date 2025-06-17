/**
 * Example of using speaker diarization with speaker_options
 *
 * Note: speaker_options and speakers_expected are mutually exclusive.
 * Use either speakers_expected for simple guidance OR speaker_options for advanced control.
 */

import { AssemblyAI, SpeakerOptions } from "assemblyai"

// Replace with your API key
const client = new AssemblyAI({
  apiKey: "YOUR_API_KEY",
})

async function transcribeWithSpeakerDiarization() {
  // Example 1: Basic speaker diarization (uses smart defaults)
  // The model automatically detects the optimal number of speakers
  let transcript = await client.transcripts.transcribe({
    audio: "https://example.com/audio.mp3",
    speaker_labels: true,
  })

  console.log("Basic speaker diarization:", transcript.id)

  // Example 2: Provide a hint with speakers_expected (smart default with guidance)
  // Still uses smart defaults but gives the model a hint about expected speakers
  transcript = await client.transcripts.transcribe({
    audio: "https://example.com/audio.mp3",
    speaker_labels: true,
    speakers_expected: 3,
  })

  console.log("With expected speakers:", transcript.id)

  // Example 3: Set boundaries with speaker_options (controlled smart defaults)
  // Constrains the smart defaults to work within specified bounds
  const speakerOptions: SpeakerOptions = {
    min_speakers_expected: 2, // At least 2 speakers (overrides smart default if < 2)
    max_speakers_expected: 4, // At most 4 speakers (overrides smart default if > 4)
  }

  transcript = await client.transcripts.transcribe({
    audio: "https://example.com/audio.mp3",
    speaker_labels: true,
    speaker_options: speakerOptions,
  })

  console.log("With speaker options:", transcript.id)

  // Note: The following would be INVALID since speakers_expected and speaker_options are mutually exclusive:
  // transcript = await client.transcripts.transcribe({
  //   audio: "https://example.com/audio.mp3",
  //   speaker_labels: true,
  //   speakers_expected: 3, // ❌ Cannot use both
  //   speaker_options: { min_speakers_expected: 2 }, // ❌ Cannot use both
  // });

  // Example 4: Edge case handling for challenging audio
  // Use speaker_options when you need precise control over speaker detection
  transcript = await client.transcripts.transcribe({
    audio: "https://example.com/audio.mp3",
    speaker_labels: true,
    speaker_options: {
      min_speakers_expected: 1, // Handle solo speakers or presentations
      max_speakers_expected: 10, // Handle large meetings or conferences
    },
  })

  console.log("Edge case handling:", transcript.id)

  // Access the utterances with speaker labels
  if (transcript.status === "completed" && transcript.utterances) {
    for (const utterance of transcript.utterances) {
      console.log(`Speaker ${utterance.speaker}: ${utterance.text}`)
    }
  }
}

// Run the example
transcribeWithSpeakerDiarization().catch(console.error)
