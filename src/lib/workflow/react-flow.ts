import {
  MarkerType,
  type Edge,
  type Node,
  type XYPosition,
} from "@xyflow/react";
import type { OrchestraNodeData, WorkflowSpec } from "./schema";

export type WorkflowFlowNode = Node<
  OrchestraNodeData,
  | "inputNode"
  | "agent"
  | "subAgent"
  | "model"
  | "tool"
  | "embeddingModel"
  | "vectorDB"
>;

const NODE_WIDTH = 240;
const NODE_HEIGHT = 132;
const COLUMN_GAP = 160;
const ROW_GAP = 72;

const reactFlowType = {
  input: "inputNode",
  agent: "agent",
  subAgent: "subAgent",
  model: "model",
  tool: "tool",
  embeddingModel: "embeddingModel",
  vectorDB: "vectorDB",
} as const;

const edgeLabels = {
  flow: "flow",
  tool: "tool",
  model: "model",
  context: "context",
  embedding: "embedding",
} as const;

const edgeHandles = {
  flow: { sourceHandle: "out", targetHandle: "in" },
  tool: { sourceHandle: "tools", targetHandle: "in" },
  model: { sourceHandle: "out", targetHandle: "in" },
  context: { sourceHandle: "out", targetHandle: "in" },
  embedding: { sourceHandle: "out", targetHandle: "in" },
} as const;

/** Places a workflow in stable left-to-right dependency layers. */
export function layoutWorkflow(workflow: WorkflowSpec) {
  const incoming = new Map(workflow.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<
    string,
    Array<{ target: string; sameColumn: boolean }>
  >();

  for (const connection of workflow.connections) {
    incoming.set(connection.to, (incoming.get(connection.to) ?? 0) + 1);
    outgoing.set(connection.from, [
      ...(outgoing.get(connection.from) ?? []),
      { target: connection.to, sameColumn: connection.kind === "tool" },
    ]);
  }

  const layers = new Map<string, number>();
  const queue = workflow.nodes
    .filter((node) => incoming.get(node.id) === 0)
    .map((node) => node.id);

  for (const id of queue) layers.set(id, 0);

  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    const layer = layers.get(id) ?? 0;

    for (const { target, sameColumn } of outgoing.get(id) ?? []) {
      layers.set(
        target,
        Math.max(layers.get(target) ?? 0, layer + (sameColumn ? 0 : 1)),
      );
      incoming.set(target, (incoming.get(target) ?? 1) - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
  }

  // Cycles are legal for flow edges; keep any cyclic remainder deterministic.
  for (const node of workflow.nodes) {
    if (!layers.has(node.id)) layers.set(node.id, 0);
  }

  const columns = new Map<number, string[]>();
  for (const node of workflow.nodes) {
    const layer = layers.get(node.id) ?? 0;
    columns.set(layer, [...(columns.get(layer) ?? []), node.id]);
  }

  const positions: Record<string, XYPosition> = {};
  for (const [layer, ids] of columns) {
    const columnHeight = ids.length * NODE_HEIGHT + (ids.length - 1) * ROW_GAP;
    ids.forEach((id, row) => {
      positions[id] = {
        x: layer * (NODE_WIDTH + COLUMN_GAP),
        y: row * (NODE_HEIGHT + ROW_GAP) - columnHeight / 2,
      };
    });
  }

  return positions;
}

export function toReactFlow(workflow: WorkflowSpec): {
  nodes: WorkflowFlowNode[];
  edges: Edge[];
} {
  const positions = layoutWorkflow(workflow);

  return {
    nodes: workflow.nodes.map((node) => ({
      id: node.id,
      type: reactFlowType[node.type],
      position: positions[node.id],
      data: node.data,
    })),
    edges: workflow.connections.map((connection) => ({
      id: connection.id,
      source: connection.from,
      target: connection.to,
      ...edgeHandles[connection.kind],
      label: edgeLabels[connection.kind],
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
    })),
  };
}
