/**
 * Example of using the LLM Gateway: OpenAI-compatible chat completions,
 * listing models, and Speech Understanding.
 */

import { AssemblyAI, LlmGatewayError } from "assemblyai"

// Replace with your API key
const client = new AssemblyAI({
  apiKey: "YOUR_API_KEY",
})

async function chatCompletionsExample() {
  const completion = await client.llmGateway.chatCompletions({
    model: "claude-haiku-4-5-20251001",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Summarize this call in one sentence." },
    ],
    max_tokens: 200,
  })

  console.log("Response:", completion.choices[0].message.content)
  console.log("Usage:", completion.usage)
}

async function listModelsExample() {
  const { data: models } = await client.llmGateway.listModels()
  for (const model of models) {
    console.log(`${model.id} — context length ${model.context_length}`)
  }
}

async function speechUnderstandingExample(transcriptId: string) {
  // Run summarization and action-item extraction over an existing transcript
  const result = await client.llmGateway.understanding({
    transcript_id: transcriptId,
    speech_understanding: {
      request: {
        summarization: { version: "v1" },
        action_items: { version: "v1" },
      },
    },
  })

  console.log("Speech Understanding result:", result)
}

async function validateBeforeRunning(transcriptId: string) {
  // Validate a Speech Understanding request without running it
  try {
    await client.llmGateway.validateUnderstanding({
      transcript_id: transcriptId,
      speech_understanding: {
        request: { translation: { version: "v1", target_languages: ["es"] } },
      },
    })
    console.log("Request is valid")
  } catch (error) {
    if (error instanceof LlmGatewayError) {
      console.error("Invalid request:", error.message, error.errors)
    } else {
      throw error
    }
  }
}

async function main() {
  await chatCompletionsExample()
  await listModelsExample()

  const transcriptId = "YOUR_TRANSCRIPT_ID"
  await validateBeforeRunning(transcriptId)
  await speechUnderstandingExample(transcriptId)
}

main().catch(console.error)
