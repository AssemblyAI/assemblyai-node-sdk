/** The part of Node's and Bun's `Buffer` that decodes base64 into memory it is given. */
type Base64Buffer = {
  from(memory: ArrayBuffer): {
    write(text: string, encoding: "base64"): number;
    toString(encoding: "base64"): string;
  };
};

/**
 * The bytes of a base64 text, as `atob()` reads it.
 *
 * Where a global `Buffer` exists (Node, Bun), its native decoder reads the
 * text: on Node 18 the `atob()` loop costs about 240 µs for 3.8 KB of
 * audio, the `Buffer` decode about 5 µs. The bytes have an `ArrayBuffer` of
 * their own, never a slice of a shared pool.
 * @throws DOMException for text that is not base64.
 */
export function base64ToBytes(text: string): Uint8Array {
  return decodeWithBuffer(text) ?? decodeWithAtob(text);
}

/**
 * The bytes when `Buffer` decodes `text` the way `atob()` would; otherwise
 * `undefined`, and `atob()` decodes or refuses it. `Buffer` skips what is not
 * base64, reads the URL-safe alphabet and keeps only the low byte of other
 * characters, so the bytes count only when they encode back to `text`
 * exactly. `Buffer` is read from `globalThis` so that a browser bundler sees
 * no reference to it and adds no polyfill.
 */
function decodeWithBuffer(text: string): Uint8Array | undefined {
  const NodeBuffer = (globalThis as { Buffer?: Base64Buffer }).Buffer;
  if (!NodeBuffer || text.length % 4 !== 0) return;
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array((text.length / 4) * 3 - padding);
  try {
    const view = NodeBuffer.from(bytes.buffer);
    view.write(text, "base64");
    if (view.toString("base64") === text) return bytes;
  } catch {
    // A partial Buffer polyfill: atob() decodes instead.
  }
  return;
}

function decodeWithAtob(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
