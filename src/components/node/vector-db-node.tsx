"use client";

import { Database } from "lucide-react";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import { NodeCard } from "./node-card";
import { NODE_THEMES, THEME } from "./themes";

export function VectorDBNode({ data, selected }: NodeProps<Node<OrchestraNodeData>>) {
  return (
    <NodeCard
      data={data}
      selected={selected}
      icon={Database}
      eyebrow="Vector Store"
      defaultLabel="Knowledge Base"
      defaultSub={data.collection ?? "Semantic memory"}
      theme={NODE_THEMES.vectorDB}
      handles={[
        { id: "in", type: "target", position: Position.Left, color: THEME.inputHandle, label: "Documents" },
        { id: "out", type: "source", position: Position.Right, color: THEME.outputHandle, label: "Context" },
      ]}
    />
  );
}
