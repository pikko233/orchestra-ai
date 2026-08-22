"use client";

import { LogIn } from "lucide-react";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import { NodeCard } from "./node-card";
import { NODE_THEMES, THEME } from "./themes";

export function InputNode({ data, selected }: NodeProps<Node<OrchestraNodeData>>) {
  return (
    <NodeCard
      data={data}
      selected={selected}
      icon={LogIn}
      eyebrow="Input"
      defaultLabel="User Input"
      defaultSub="Workflow entry point"
      theme={NODE_THEMES.input}
      handles={[
        { id: "out", type: "source", position: Position.Right, color: THEME.outputHandle, label: "Output" },
      ]}
    />
  );
}
