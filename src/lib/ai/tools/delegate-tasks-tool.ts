import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { tools as openAITools } from "@langchain/openai";
import { createAgent, tool, type ToolRuntime } from "langchain";
import { z } from "zod";
import {
  workflowChatModelRegistry,
  type WorkflowChatModelName,
} from "@/lib/workflow/schema";

const MAX_DELEGATED_TASKS = 6;
const MAX_CONCURRENT_SUB_AGENTS = 3;
const SUB_AGENT_TIMEOUT_MS = 60_000;

const delegatedTaskSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  role: z.string().trim().min(1).max(120),
  task: z.string().trim().min(1).max(4_000),
  expectedOutput: z.string().trim().min(1).max(1_000),
  modelName: z.enum(workflowChatModelRegistry).optional(),
});

const delegateTasksSchema = z.object({
  tasks: z.array(delegatedTaskSchema).min(1).max(MAX_DELEGATED_TASKS),
});

export type DynamicSubAgentEvent = {
  type: "subagent";
  runId: string;
  parentNodeId: string;
  subAgentId: string;
  role: string;
  modelName: WorkflowChatModelName;
  status: "running" | "success" | "error";
  error?: string;
};

const SUB_AGENT_PROMPT = `
你是由主 Agent 临时创建的 Sub Agent。

- 只完成本次分配的任务，不扩展任务范围；
- 返回结论、关键依据、风险和未解决问题；
- 不创建或委派其他 Agent；
- 使用精简 Markdown，正文控制在 800 个汉字以内。
`.trim();

async function runWithConcurrency<T, R>(
  values: T[],
  worker: (value: T) => Promise<R>,
) {
  const results = new Array<PromiseSettledResult<R>>(values.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_SUB_AGENTS, values.length) },
      async () => {
        while (nextIndex < values.length) {
          const index = nextIndex++;
          try {
            results[index] = {
              status: "fulfilled",
              value: await worker(values[index]),
            };
          } catch (reason) {
            results[index] = { status: "rejected", reason };
          }
        }
      },
    ),
  );

  return results;
}

export function createDelegateTasksTool({
  createModel,
  defaultModelName,
  parentNodeId,
}: {
  createModel: (modelName: WorkflowChatModelName) => BaseChatModel;
  defaultModelName: WorkflowChatModelName;
  parentNodeId: string;
}) {
  return tool(
    async ({ tasks }, runtime: ToolRuntime) => {
      const results = await runWithConcurrency(tasks, async (task) => {
        const modelName = task.modelName ?? defaultModelName;
        const event = (
          status: DynamicSubAgentEvent["status"],
          error?: string,
        ) =>
          runtime.writer?.({
            type: "subagent",
            runId: runtime.toolCallId,
            parentNodeId,
            subAgentId: task.id,
            role: task.role,
            modelName,
            status,
            error,
          } satisfies DynamicSubAgentEvent);

        event("running");

        try {
          const subAgent = createAgent({
            name: `subagent_${task.id}`,
            model: createModel(modelName),
            tools: [openAITools.webSearch()],
            systemPrompt: SUB_AGENT_PROMPT,
          });
          const config = runtime.config || runtime;
          const signals = [
            config.signal,
            AbortSignal.timeout(SUB_AGENT_TIMEOUT_MS),
          ].filter((value): value is AbortSignal => value !== undefined);
          const result = await subAgent.invoke(
            {
              messages: [
                {
                  role: "user",
                  content: [
                    `角色：${task.role}`,
                    `任务：${task.task}`,
                    `期望输出：${task.expectedOutput}`,
                  ].join("\n"),
                },
              ],
            },
            { ...config, signal: AbortSignal.any(signals) },
          );
          const output = result.messages.at(-1)?.text.trim();

          if (!output) throw new Error("Sub Agent 未返回内容");
          event("success");

          return {
            id: task.id,
            role: task.role,
            modelName,
            status: "success" as const,
            output,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Sub Agent 执行失败";
          event("error", message);
          throw error;
        }
      });

      return {
        results: results.map((result, index) =>
          result.status === "fulfilled"
            ? result.value
            : {
                id: tasks[index].id,
                role: tasks[index].role,
                modelName: tasks[index].modelName ?? defaultModelName,
                status: "error" as const,
                error:
                  result.reason instanceof Error
                    ? result.reason.message
                    : "Sub Agent 执行失败",
              },
        ),
      };
    },
    {
      name: "delegate_tasks",
      description:
        "将 1 到 6 个互相独立的任务并行委派给临时 Sub Agent。每个任务可选择允许的 modelName；未指定则继承主 Agent 模型。等待全部完成后返回结构化结果。",
      schema: delegateTasksSchema,
    },
  );
}
