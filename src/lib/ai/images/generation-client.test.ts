import assert from "node:assert/strict";
import test from "node:test";
import { requestGeneratedImage } from "./generation-client";

test("requests a GPT-Image-2 PNG", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousBaseUrl = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = "https://example.test/v1/";
  let requestBody: Record<string, unknown> | undefined;

  try {
    const image = await requestGeneratedImage(
      {
        prompt: "画一只猫",
        size: "1024x1024",
        quality: "medium",
      },
      undefined,
      async (input, init) => {
        assert.equal(input, "https://example.test/v1/images/generations");
        assert.equal(
          new Headers(init?.headers).get("Authorization"),
          "Bearer test-key",
        );
        requestBody = JSON.parse(String(init?.body));
        return Response.json({
          data: [{ b64_json: Buffer.from("image").toString("base64") }],
        });
      },
    );

    assert.equal(image.toString(), "image");
    assert.deepEqual(requestBody, {
      model: "gpt-image-2",
      prompt: "画一只猫",
      size: "1024x1024",
      quality: "medium",
      output_format: "png",
    });
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = previousBaseUrl;
  }
});
