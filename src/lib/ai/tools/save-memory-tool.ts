import { tool, type ToolRuntime } from "langchain";
import type { BaseStore } from "@langchain/langgraph";
import z from "zod";
import type { AgentContextType } from "../memory/schema";

export const saveMemoryTool = tool(
  async (
    { scope, content },
    runtime: ToolRuntime<unknown, AgentContextType>,
  ) => {
    const { projectId, userId } = runtime.context;
    if (!projectId || !userId) {
      throw new Error("缺少项目ID或者用户ID");
    }

    // ToolRuntime currently exposes the generic Core store type, while agents
    // inject a LangGraph BaseStore for long-term memory at runtime.
    const store = runtime.store as BaseStore | null;
    if (!store) {
      throw new Error("长期记忆 Store 未配置");
    }

    const isProjectMemory = scope === "project";
    const namespace = isProjectMemory
      ? ["users", userId, "projects"]
      : ["users", userId];
    const key = isProjectMemory ? projectId : "userInfo";
    const existingMemory = await store.get(namespace, key);
    const now = new Date().toISOString();

    await store.put(
      namespace,
      key,
      {
        content,
        createdAt: existingMemory?.value.createdAt ?? now,
        updatedAt: now,
      },
      false,
    );

    return existingMemory ? "长期记忆已更新" : "长期记忆已保存";
  },
  {
    name: "save_memory",
    description:
      "保存或更新完整的长期记忆文档；用户提供姓名、身份、长期偏好或项目长期决策时必须调用",
    schema: z.object({
      scope: z.enum(["user", "project"]),
      content: z
        .string()
        .trim()
        .min(1)
        .describe("合并新信息并保留有效旧信息后的完整 Markdown 记忆文档"),
    }),
  },
);
