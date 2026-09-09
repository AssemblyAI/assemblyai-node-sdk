import "dotenv/config";
import { AssemblyAI } from "../../src";

const knownTranscriptId = process.env.TEST_TRANSCRIPT_ID!;

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

describe("llmGateway", () => {
  it("should create a chat completion", async () => {
    const completion = await client.llmGateway.chatCompletions({
      model: "claude-haiku-4-5-20251001",
      messages: [{ role: "user", content: "Reply with exactly: pong" }],
      max_tokens: 10,
    });

    expect(completion.request_id).toBeTruthy();
    expect(completion.choices[0].message.content).toBeTruthy();
    expect(completion.usage.total_tokens).toBeGreaterThan(0);
  });

  it("should list available models", async () => {
    const { data: models } = await client.llmGateway.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toBeTruthy();
  });

  it("should validate and run a speech understanding request", async () => {
    const request = {
      transcript_id: knownTranscriptId,
      speech_understanding: {
        request: { summarization: { version: "v1" } },
      },
    };

    await expect(
      client.llmGateway.validateUnderstanding(request),
    ).resolves.toBeUndefined();

    const result = await client.llmGateway.understanding(request);
    expect(result).toBeTruthy();
  });
});
