import "dotenv/config";
import { AssemblyAI } from "../../src";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});
const knownTranscriptIds = process.env.TEST_TRANSCRIPT_IDS?.split(",");

describe("lemur", () => {
  it("should generate a summary", async () => {
    const { response } = await client.lemur.summary({
      final_model: "basic",
      transcript_ids: knownTranscriptIds,
      answer_format: "one sentence",
    });

    expect(response).toBeTruthy();
  });

  it("should generate an answer", async () => {
    const { response } = await client.lemur.questionAnswer({
      final_model: "basic",
      transcript_ids: knownTranscriptIds,
      questions: [
        {
          question: "What are they discussing?",
          answer_format: "text",
        },
      ],
    });

    expect(response).toBeTruthy();
    expect(response).toHaveLength(1);
  });

  it("should generate action items", async () => {
    const { response } = await client.lemur.actionItems({
      final_model: "basic",
      transcript_ids: knownTranscriptIds,
    });

    expect(response).toBeTruthy();
  });

  it("should generate a task", async () => {
    const { response } = await client.lemur.task({
      final_model: "basic",
      transcript_ids: knownTranscriptIds,
      prompt: "Write a haiku about this conversation.",
    });

    expect(response).toBeTruthy();
  });

  it("should fail to generate a summary", async () => {
    const promise = client.lemur.summary({
      final_model: "basic",
      transcript_ids: ["bad-id"],
      answer_format: "one sentence",
    });

    await expect(promise).rejects.toThrowError(
      "each transcript source id must be valid",
    );
  });

  it("should purge request data", async () => {
    const { request_id } = await client.lemur.summary({
      final_model: "basic",
      transcript_ids: knownTranscriptIds,
      answer_format: "one sentence",
    });

    const deletionRequest = await client.lemur.purgeRequestData(request_id);
    expect(deletionRequest.deleted).toBeTruthy();
    expect(deletionRequest.request_id_to_purge).toBe(request_id);
  });
});
