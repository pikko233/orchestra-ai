import "server-only";

import { memoryStore } from "@/lib/ai/memory/store";
import type { AgentContextType } from "@/lib/ai/memory/schema";
import type { WorkflowSpec } from "../schema";
import { compileWorkflow } from "./compiler";
import type { WorkflowNodeEvent } from "./executor";

export type WorkflowRunEvent =
  | WorkflowNodeEvent
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
      if (isNodeEvent(payload)) yield payload;
    } else if (mode === "messages") {
      const [chunk, metadata] = payload;
      if (chunk.text) {
        yield {
          type: "message",
          nodeId: metadata.workflowNodeId,
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

function isNodeEvent(value: unknown): value is WorkflowNodeEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<WorkflowNodeEvent>;
  return (
    event.type === "node" &&
    typeof event.nodeId === "string" &&
    ["running", "success", "error"].includes(event.status ?? "")
  );
}
