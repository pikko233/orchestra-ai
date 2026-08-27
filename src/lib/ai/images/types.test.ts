import assert from "node:assert/strict";
import test from "node:test";
import { chatImageSchema } from "./types";

const image = {
  id: "image-1",
  filename: "image.png",
  mimeType: "image/png" as const,
  source: "generated" as const,
};

test("accepts only absolute HTTP image URLs", () => {
  assert.equal(
    chatImageSchema.safeParse({ ...image, url: "https://example.com/a.png" })
      .success,
    true,
  );
  assert.equal(
    chatImageSchema.safeParse({ ...image, url: "javascript:alert(1)" })
      .success,
    false,
  );
  assert.equal(
    chatImageSchema.safeParse({ ...image, url: "not-a-url" }).success,
    false,
  );
});
