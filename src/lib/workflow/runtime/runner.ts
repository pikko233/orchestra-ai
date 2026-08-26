import "server-only";

import { memoryStore } from "@/lib/ai/memory/store";
import type { AgentContextType } from "@/lib/ai/memory/schema";
import type { WorkflowSpec } from "../schema";
import { compileWorkflow, getWorkflowOutputNodeIds } from "./compiler";
import type { WorkflowNodeEvent } from "./executor";
import type { DynamicSubAgentEvent } from "@/lib/ai/tools/delegate-tasks-tool";

export type WorkflowRunEvent =
  | WorkflowNodeEvent
  | DynamicSubAgentEvent
  | { type: "message"; nodeId?: string; delta: string }
  | { type: "tool"; nodeId?: string; data: unknown }
  | { type: "end" };

export async function* runWorkflow({
  workflow,
  message,
  context,
  signal,
}: {
  workflow: WorkflowSpec;
  message: string;
  context: AgentContextType;
  signal?: AbortSignal;
}): AsyncGenerator<WorkflowRunEvent> {
  const outputNodeIds = getWorkflowOutputNodeIds(workflow);
  const graph = await compileWorkflow(workflow, { store: memoryStore });
  const stream = await graph.stream(
    { messages: [{ role: "user", content: message }] },
    {
      context,
      signal,
      streamMode: ["custom", "messages", "tools"],
    },
  );

  for await (const [mode, payload] of stream) {
    if (mode === "custom") {
      if (isNodeEvent(payload) || isDynamicSubAgentEvent(payload)) yield payload;
    } else if (mode === "messages") {
      const [chunk, metadata] = payload;
      const nodeId = metadata.workflowNodeId;
      if (
        chunk.text &&
        typeof metadata.lc_agent_name !== "string" &&
        typeof nodeId === "string" &&
        outputNodeIds.has(nodeId)
      ) {
        yield {
          type: "message",
          nodeId,
          delta: chunk.text,
        };
      }
    } else {
      yield {
        type: "tool",
        data: payload,
      };
    }
  }

  yield { type: "end" };
}

function isDynamicSubAgentEvent(
  value: unknown,
): value is DynamicSubAgentEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<DynamicSubAgentEvent>;
  return (
    event.type === "subagent" &&
    typeof event.runId === "string" &&
    typeof event.parentNodeId === "string" &&
    typeof event.subAgentId === "string" &&
    typeof event.role === "string" &&
    typeof event.modelName === "string" &&
    ["running", "success", "error"].includes(event.status ?? "")
  );
}

function isNodeEvent(value: unknown): value is WorkflowNodeEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<WorkflowNodeEvent>;
  return (
    event.type === "node" &&
    typeof event.nodeId === "string" &&
    ["running", "success", "error"].includes(event.status ?? "")
  );
}
