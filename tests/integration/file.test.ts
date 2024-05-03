import { createReadStream } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import "dotenv/config";
import { AssemblyAI } from "../../src";

const testDir = process.env["TESTDATA_DIR"] ?? "tests/static";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

describe("files", () => {
  it("should upload a file from path", async () => {
    const uploadUrl = await client.files.upload(path.join(testDir, "gore.wav"));
    expect(uploadUrl).toBeTruthy();
  });

  it("should upload a file from data URI", async () => {
    const dataUri = `data:audio/wav;base64,${await readFile(
      path.join(testDir, "gore.wav"),
      "base64",
    )}`;
    const uploadUrl = await client.files.upload(dataUri);
    expect(uploadUrl).toBeTruthy();
  });

  it("should upload a file from stream", async () => {
    const stream = createReadStream(path.join(testDir, "gore.wav"));
    const uploadUrl = await client.files.upload(stream);
    expect(uploadUrl).toBeTruthy();
  });

  it("should upload a file from buffer", async () => {
    const data = await readFile(path.join(testDir, "gore.wav"));
    const uploadUrl = await client.files.upload(data);
    expect(uploadUrl).toBeTruthy();
  });
});
