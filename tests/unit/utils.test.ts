import fetchMock from "jest-fetch-mock";
import { AssemblyAI } from "../../src";
import { getPath } from "../../src/utils/path";

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
});
