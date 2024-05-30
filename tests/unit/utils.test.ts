import fetchMock from "jest-fetch-mock";
import { AssemblyAI } from "../../src";
import { getPath } from "../../src/utils/path";
import { buildUserAgent } from "../../src/utils/userAgent";

fetchMock.enableMocks();

const assembly = new AssemblyAI({
  apiKey: "",
});

beforeEach(() => {
  fetchMock.doMock();
});

describe("utils", () => {
  it("should throw AssemblyAI API error", async () => {
    const error = { error: "error" };
    fetchMock.mockResponseOnce(JSON.stringify(error), { status: 500 });
    await expect(() => assembly.transcripts.get("123")).rejects.toThrow(
      error.error,
    );
  });
  it("should throw HTTP error", async () => {
    const error = "error";
    fetchMock.mockResponseOnce(JSON.stringify(error), { status: 500 });
    await expect(() => assembly.transcripts.get("123")).rejects.toThrow(error);
  });

  it("should return correct path", () => {
    const dict = [
      ["path/to/file", "path/to/file"],
      ["/path/to/file", "/path/to/file"],
      ["./path/to/file", "./path/to/file"],
      ["C:/path/to/file", "C:/path/to/file"],
      ["D:/path/to/file", "D:/path/to/file"],
      ["C:\\path\\to\\file", "C:\\path\\to\\file"],
      ["D:\\path\\to\\file", "D:\\path\\to\\file"],
      ["http://example.com", null],
      ["https://example.com", null],
      ["file://path/to/file", "path/to/file"],
      ["file://C:/path/to/file", "C:/path/to/file"],
      ["file://D:/path/to/file", "D:/path/to/file"],
      ["file:path/to/file", "path/to/file"],
      ["file:C:/path/to/file", "C:/path/to/file"],
      ["file:D:/path/to/file", "D:/path/to/file"],
      ["file:C:\\path\\to\\file", "C:\\path\\to\\file"],
      ["file:D:\\path\\to\\file", "D:\\path\\to\\file"],
      ["file://C:\\path\\to\\file", "C:\\path\\to\\file"],
      ["file://D:\\path\\to\\file", "D:\\path\\to\\file"],
    ];
    for (const [input, output] of dict) {
      expect(getPath(input as string)).toEqual(output);
    }
  });

  it("should build a user-agent", () => {
    const userAgent = buildUserAgent({});
    expect(userAgent).toContain("AssemblyAI/1.0 (");
    expect(userAgent).toContain("sdk=JavaScript/__SDK_VERSION__");
    expect(userAgent).toContain("runtime_env=Node/");
  });

  it("should build a user-agent with extras", () => {
    const userAgent = buildUserAgent({
      integration: { name: "Zapier", version: "1.0.0" },
    });
    expect(userAgent).toContain("AssemblyAI/1.0 (");
    expect(userAgent).toContain("sdk=JavaScript/__SDK_VERSION__");
    expect(userAgent).toContain("runtime_env=Node/");
    expect(userAgent).toContain("integration=Zapier/1.0.0");
  });

  it("should build a user-agent without AssemblyAI product", () => {
    const userAgent = buildUserAgent(false);
    expect(userAgent).not.toContain("AssemblyAI/1.0 (");
    expect(userAgent).not.toContain("sdk=JavaScript/__SDK_VERSION__");
    expect(userAgent).not.toContain("runtime_env=Node/");
    expect(userAgent).not.toContain("integration=Zapier/1.0.0");
  });

  it("should build a user-agent with override", () => {
    const userAgent = buildUserAgent({
      sdk: {
        name: "TS",
        version: "1.0",
      },
      os: undefined,
    });
    expect(userAgent).toContain("AssemblyAI/1.0 (");
    expect(userAgent).toContain("sdk=TS/1.0");
    expect(userAgent).toContain("runtime_env=Node/");
    expect(userAgent).not.toContain("os=");
  });

  it("should make request with user agent", async () => {
    fetchMock.enableMocks();
    fetchMock.resetMocks();
    fetchMock.doMock();
    fetchMock.mockResponseOnce((req) => {
      expect(req.headers.has("User-Agent")).toBeTruthy();
      return Promise.resolve(JSON.stringify({}));
    });
    const service = new AssemblyAI({
      apiKey: "test",
    });
    await service.files.upload(new Blob());
  });
  it("should make request without user agent", async () => {
    fetchMock.enableMocks();
    fetchMock.resetMocks();
    fetchMock.doMock();
    fetchMock.mockResponseOnce((req) => {
      expect(req.headers.has("User-Agent")).toBeFalsy();
      return Promise.resolve(JSON.stringify({}));
    });
    const service = new AssemblyAI({
      apiKey: "test",
      userAgent: false,
    });
    await service.files.upload(new Blob());
  });
});
