import { base64ToBytes } from "../../src/utils/base64";

/** What `atob()` makes of `text`: its bytes, or "refused". */
function atobBytes(text: string): number[] | "refused" {
  let binary: string;
  try {
    binary = atob(text);
  } catch {
    return "refused";
  }
  return Array.from(binary, (char) => char.charCodeAt(0));
}

function decoded(text: string): number[] | "refused" {
  try {
    return Array.from(base64ToBytes(text));
  } catch {
    return "refused";
  }
}

/** Texts `Buffer` decodes differently from `atob()`, and canonical ones. */
const edgeCases = [
  "",
  "QQ==",
  "QUI=",
  "QUJD",
  "QR==", // non-zero trailing bits: atob() ignores them
  "QQ", // no padding: atob() accepts it
  "QQ=",
  "QQ==QQ==",
  "====",
  "A===",
  "AB=C",
  "QUJ-",
  "QUJ_",
  "QUJń", // Buffer reads U+0144 as "D"
  "QUJÄ",
  "QUJ\u{1f600}",
  "QU JE",
  "QUJD\nRA==",
  " QUJD",
  "not base64!",
];

/** Random texts over base64, padding, whitespace and other characters. */
function randomTexts(count: number): string[] {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" +
    "==== \n-_!Äń";
  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
  const texts: string[] = [];
  for (let n = 0; n < count; n++) {
    const length = Math.floor(random() * 13);
    let text = "";
    for (let i = 0; i < length; i++) {
      text += alphabet[Math.floor(random() * alphabet.length)];
    }
    texts.push(text);
  }
  return texts;
}

/** Bytes of every length remainder, the sizes of real audio frames included. */
const audioSizes = [0, 1, 2, 3, 4, 5, 100, 3839, 3840, 3841, 7680, 19200];

function audio(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 2654435761) >>> 24;
  return bytes;
}

describe("base64ToBytes", () => {
  const nodeBuffer = globalThis.Buffer;
  afterEach(() => {
    globalThis.Buffer = nodeBuffer;
    jest.restoreAllMocks();
  });

  describe.each([
    { runtime: "with Buffer (Node, Bun)", buffer: nodeBuffer },
    { runtime: "without Buffer (a browser)", buffer: undefined },
  ])("$runtime", ({ buffer }) => {
    beforeEach(() => {
      (globalThis as { Buffer?: unknown }).Buffer = buffer;
    });

    it("reads every text as atob() does, refusing what it refuses", () => {
      const texts = [...edgeCases, ...randomTexts(5000)];
      const differ = texts.filter(
        (text) =>
          JSON.stringify(decoded(text)) !== JSON.stringify(atobBytes(text)),
      );
      expect(differ).toEqual([]);
    });

    it.each(audioSizes)(
      "decodes %i bytes into an ArrayBuffer of their own",
      (size) => {
        const bytes = audio(size);
        const text = nodeBuffer.from(bytes).toString("base64");
        const result = base64ToBytes(text);
        expect(result.constructor).toBe(Uint8Array); // not a Buffer
        expect(nodeBuffer.from(result).toString("hex")).toBe(
          nodeBuffer.from(bytes).toString("hex"),
        );
        expect(result.byteOffset).toBe(0);
        expect(result.buffer.byteLength).toBe(size);
      },
    );
  });

  it("decodes canonical base64 with Buffer, not the atob() loop", () => {
    const atob = jest.spyOn(globalThis, "atob");
    const bytes = audio(3840);
    expect(base64ToBytes(nodeBuffer.from(bytes).toString("base64"))).toEqual(
      bytes,
    );
    expect(atob).not.toHaveBeenCalled();
  });

  it("leaves text Buffer reads differently to atob()", () => {
    const atob = jest.spyOn(globalThis, "atob");
    expect(() => base64ToBytes("QUJ-")).toThrow();
    expect(Array.from(base64ToBytes("QR=="))).toEqual([0x41]);
    expect(atob).toHaveBeenCalledTimes(2);
  });

  it("falls back to atob() under a Buffer polyfill that cannot decode", () => {
    (globalThis as { Buffer?: unknown }).Buffer = {
      from: () => ({}),
    };
    expect(Array.from(base64ToBytes("QUJD"))).toEqual([0x41, 0x42, 0x43]);
    expect(() => base64ToBytes("QUJ-")).toThrow();
  });
});
