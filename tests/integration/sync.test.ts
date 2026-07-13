import path from "path";
import "dotenv/config";
import { AssemblyAI } from "../../src";

const testDir = process.env["TESTDATA_DIR"] ?? "tests/static";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

describe("sync", () => {
  it("should transcribe a local file in one request", async () => {
    const result = await client.sync.transcribe(
      path.join(testDir, "gore-short.wav"),
    );

    expect(result.text).toBeTruthy();
    expect(result.session_id).toBeTruthy();
    expect(result.audio_duration_ms).toBeGreaterThan(0);
    expect(result.words.length).toBeGreaterThan(0);
    expect(result.words[0].end).toBeGreaterThan(result.words[0].start);
  });

  it("should warm the connection and then transcribe", async () => {
    const warmed = await client.sync.warm();
    expect(warmed).toBe(true);

    const result = await client.sync.transcribe(
      path.join(testDir, "gore-short.wav"),
    );
    expect(result.text).toBeTruthy();
  });
});
