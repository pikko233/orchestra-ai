import assert from "node:assert/strict";
import test from "node:test";
import { readSse } from "./sse";

test("cancels the stream when the consumer stops after a terminal event", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode('event: end\ndata: {"type":"end"}\n\n'),
      );
    },
    cancel() {
      cancelled = true;
    },
  });

  for await (const event of readSse(stream)) {
    assert.equal(event.event, "end");
    break;
  }

  assert.equal(cancelled, true);
});
