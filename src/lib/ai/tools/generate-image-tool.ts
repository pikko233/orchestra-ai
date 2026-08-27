import { tool, type ToolRuntime } from "langchain";
import { UTApi, UTFile } from "uploadthing/server";
import type { AgentContextType } from "@/lib/ai/memory/schema";
import {
  imageGenerationSchema,
  requestGeneratedImage,
} from "@/lib/ai/images/generation-client";

const uploadThing = new UTApi();

export const generateImageTool = tool(
  async (input, runtime: ToolRuntime<unknown, AgentContextType>) => {
    if (!runtime.context) throw new Error("缺少图片生成上下文");
    const data = await requestGeneratedImage(input, runtime.config.signal);
    const filename = `generated-${Date.now()}.png`;
    const result = await uploadThing.uploadFiles(
      new UTFile([new Uint8Array(data)], filename, { type: "image/png" }),
      { signal: runtime.config.signal },
    );
    if (result.error) throw new Error(result.error.message);

    return {
      id: result.data.key,
      filename,
      mimeType: "image/png" as const,
      source: "generated" as const,
      url: result.data.ufsUrl,
    };
  },
  {
    name: "generate_image",
    description:
      "仅在用户明确要求生成图片时使用。根据文字描述生成一张 PNG 图片，并返回可在聊天中展示的图片信息。",
    schema: imageGenerationSchema,
  },
);
