"use client";

import { Binary } from "lucide-react";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import { NodeCard } from "./node-card";
import { NODE_THEMES, THEME } from "./themes";

export function EmbeddingModelNode({ data, selected }: NodeProps<Node<OrchestraNodeData>>) {
  const fallback = data.dimensions
    ? `${String(data.dimensions)} dimensions`
    : "Text embedding model";

  return (
    <NodeCard
      data={data}
      selected={selected}
      icon={Binary}
      eyebrow="Embedding"
      defaultLabel="Embedding Model"
      defaultSub={fallback}
      theme={NODE_THEMES.embeddingModel}
      handles={[
        { id: "in", type: "target", position: Position.Left, color: THEME.inputHandle, label: "Text" },
        { id: "out", type: "source", position: Position.Right, color: THEME.outputHandle, label: "Vector" },
      ]}
    />
  );
}
