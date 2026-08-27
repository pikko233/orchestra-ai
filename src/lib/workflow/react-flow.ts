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

const DEFAULT_NODE_SIZE = { width: 224, height: 132 };
const COMPACT_NODE_SIZE = { width: 112, height: 96 };
const TOOL_NODE_SIZE = { width: 224, height: 56 };
const COLUMN_GAP = 120;
const ROW_GAP = 72;

function getNodeSize(type: WorkflowSpec["nodes"][number]["type"]) {
  if (type === "input" || type === "model") return COMPACT_NODE_SIZE;
  if (type === "tool") return TOOL_NODE_SIZE;
  return DEFAULT_NODE_SIZE;
}

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
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  for (const node of workflow.nodes) {
    const layer = layers.get(node.id) ?? 0;
    columns.set(layer, [...(columns.get(layer) ?? []), node.id]);
  }

  const positions: Record<string, XYPosition> = {};
  let columnX = 0;
  for (const layer of [...columns.keys()].sort((left, right) => left - right)) {
    const ids = columns.get(layer) ?? [];
    const sizes = ids.map((id) => getNodeSize(nodes.get(id)!.type));
    const columnHeight =
      sizes.reduce((total, size) => total + size.height, 0) +
      Math.max(0, sizes.length - 1) * ROW_GAP;
    let nodeY = -columnHeight / 2;

    ids.forEach((id, row) => {
      positions[id] = {
        x: columnX,
        y: nodeY,
      };
      nodeY += sizes[row].height + ROW_GAP;
    });

    const columnWidth = Math.max(...sizes.map(({ width }) => width));
    columnX += columnWidth + COLUMN_GAP;
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
      position: node.position ?? positions[node.id],
      data: node.data,
    })),
    edges: workflow.connections.map((connection) => ({
      id: connection.id,
      source: connection.from,
      target: connection.to,
      ...edgeHandles[connection.kind],
      label: edgeLabels[connection.kind],
      type: "bezier",
      markerEnd: { type: MarkerType.ArrowClosed },
    })),
  };
}
