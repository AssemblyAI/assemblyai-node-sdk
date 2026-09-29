import { liveChunks } from "../../src/utils/live";

function sourceStream(
  chunks: unknown[],
  onCancel: jest.Mock,
): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++] as Uint8Array);
      } else {
        controller.close();
      }
    },
    cancel: onCancel,
  });
}

describe("liveChunks with a web ReadableStream", () => {
  it("yields every chunk and leaves a fully read stream alone", async () => {
    const onCancel = jest.fn();
    const received: number[] = [];
    for await (const chunk of liveChunks(
      sourceStream([new Uint8Array([1, 2]), new Uint8Array([3])], onCancel),
    )) {
      received.push(...chunk);
    }

    expect(received).toEqual([1, 2, 3]);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels the source when the consumer stops early", async () => {
    const onCancel = jest.fn();
    const chunks = liveChunks(
      sourceStream(
        [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])],
        onCancel,
      ),
    );

    const first = await chunks.next();
    expect(first.value).toEqual(new Uint8Array([1]));
    await chunks.return(undefined);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cancels the source when a chunk is not bytes", async () => {
    const onCancel = jest.fn();
    const chunks = liveChunks(
      sourceStream(
        [new Uint8Array([1]), "text", new Uint8Array([3])],
        onCancel,
      ),
    );

    await chunks.next();
    await expect(chunks.next()).rejects.toThrow(TypeError);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
