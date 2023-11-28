import { createReadStream } from "fs";
import { readFile } from "fs/promises";
import fetchMock from "jest-fetch-mock";
import path from "path";
import { createClient, requestMatches } from "./utils";

fetchMock.enableMocks();

const testDir = process.env["TESTDATA_DIR"] ?? ".";

const assembly = createClient();

beforeEach(() => {
  fetchMock.resetMocks();
  fetchMock.doMock();
});

describe("files", () => {
  it("should upload a file from path", async () => {
    fetchMock.doMockIf(
      requestMatches({ method: "POST", url: "/v2/upload" }),
      JSON.stringify({ upload_url: "https://example.com" })
    );
    const uploadUrl = await assembly.files.upload(
      path.join(testDir, "gore.wav")
    );
    expect(uploadUrl).toBeTruthy();
  });

  it("should upload a file from stream", async () => {
    fetchMock.doMockIf(
      requestMatches({ method: "POST", url: "/v2/upload" }),
      JSON.stringify({ upload_url: "https://example.com" })
    );
    const stream = createReadStream(path.join(testDir, "gore.wav"));
    const uploadUrl = await assembly.files.upload(stream);
    expect(uploadUrl).toBeTruthy();
  });

  it("should upload a file from buffer", async () => {
    fetchMock.doMockIf(
      requestMatches({ method: "POST", url: "/v2/upload" }),
      JSON.stringify({ upload_url: "https://example.com" })
    );
    const data = await readFile(path.join(testDir, "gore.wav"));
    const uploadUrl = await assembly.files.upload(data);
    expect(uploadUrl).toBeTruthy();
  });
});
