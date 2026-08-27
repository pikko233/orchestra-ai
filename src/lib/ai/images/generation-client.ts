import { z } from "zod";

export const imageGenerationSchema = z.object({
  prompt: z.string().trim().min(1).max(4_000),
  size: z
    .enum(["1024x1024", "1024x1536", "1536x1024"])
    .default("1024x1024"),
  quality: z.enum(["low", "medium", "high"]).default("medium"),
});

export type ImageGenerationInput = z.infer<typeof imageGenerationSchema>;

const responseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string().min(1) })).min(1),
});

export async function requestGeneratedImage(
  input: ImageGenerationInput,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("缺少 OPENAI_API_KEY");

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const response = await fetcher(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: input.prompt,
      size: input.size,
      quality: input.quality,
      output_format: "png",
    }),
    signal,
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      result &&
      typeof result === "object" &&
      "error" in result &&
      result.error &&
      typeof result.error === "object" &&
      "message" in result.error &&
      typeof result.error.message === "string"
        ? result.error.message
        : `图片生成失败（${response.status}）`;
    throw new Error(message);
  }

  const parsed = responseSchema.safeParse(result);
  if (!parsed.success) throw new Error("图片生成接口未返回有效图片");
  return Buffer.from(parsed.data.data[0].b64_json, "base64");
}
