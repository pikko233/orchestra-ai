import {
  type LangGraphRunnableConfig,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { ChatOpenAI, tools as openAITools } from "@langchain/openai";
import { createAgent } from "langchain";
import {
  agentContextSchema,
  type AgentContextType,
} from "@/lib/ai/memory/schema";
import { saveMemoryTool } from "@/lib/ai/tools/save-memory-tool";
import { loadWorkflowSkills } from "@/lib/ai/skills";
import type { WorkflowNode } from "../schema";

export type AgentNode =
  | Extract<WorkflowNode, { type: "agent" }>
  | Extract<WorkflowNode, { type: "subAgent" }>;
export type ModelNode = Extract<WorkflowNode, { type: "model" }>;
export type ToolNode = Extract<WorkflowNode, { type: "tool" }>;

export type WorkflowNodeEvent = {
  type: "node";
  nodeId: string;
  status: "running" | "success" | "error";
  error?: string;
};

const tools = {
  search: openAITools.webSearch(),
  save_memory: saveMemoryTool,
};

const MAX_NODE_OUTPUT_TOKENS = 3_000;
const NODE_OUTPUT_RULES = `
## 输出要求

- 只完成当前节点负责的内容，不要代替后续节点完成任务；
- 基于上游结果继续工作，不要复述用户需求或大段重复上游内容；
- 使用精简 Markdown，正文控制在 800 个汉字以内；
- 优先保留结论、关键细节和可交接信息，省略思考过程、客套话和重复总结；
- 如果内容较多，主动压缩，确保在完整句子处结束。
`.trim();

function createModel(node: ModelNode) {
  const provider = (node.data.provider ?? "openai").toLowerCase();
  if (provider !== "openai") {
    throw new Error(`模型 Provider 尚未支持：${provider}`);
  }

  return new ChatOpenAI({
    model: node.data.modelName,
    maxTokens: MAX_NODE_OUTPUT_TOKENS,
    useResponsesApi: true,
    configuration: node.data.endpoint
      ? { baseURL: node.data.endpoint }
      : undefined,
  });
}

export function createAgentExecutor(
  node: AgentNode,
  modelNode: ModelNode,
  toolNodes: ToolNode[],
) {
  const skillInstructions = loadWorkflowSkills(node.data.skills ?? []);
  const agent = createAgent({
    model: createModel(modelNode),
    tools: toolNodes.map((node) => tools[node.data.registryKey]),
    systemPrompt: [node.data.instructions, skillInstructions, NODE_OUTPUT_RULES]
      .filter(Boolean)
      .join("\n\n"),
    contextSchema: agentContextSchema,
  });

  return async (
    state: typeof MessagesAnnotation.State,
    config: LangGraphRunnableConfig<AgentContextType>,
  ): Promise<typeof MessagesAnnotation.Update> => {
    const emit = (event: WorkflowNodeEvent) => config.writer?.(event);
    emit({ type: "node", nodeId: node.id, status: "running" });

    try {
      if (!config.context) throw new Error("缺少工作流运行上下文");

      const result = await agent.invoke(
        { messages: state.messages },
        {
          ...config,
          context: config.context,
          metadata: { ...config.metadata, workflowNodeId: node.id },
        },
      );

      emit({ type: "node", nodeId: node.id, status: "success" });
      return { messages: result.messages.slice(state.messages.length) };
    } catch (error) {
      emit({
        type: "node",
        nodeId: node.id,
        status: "error",
        error: error instanceof Error ? error.message : "节点执行失败",
      });
      throw error;
    }
  };
}
