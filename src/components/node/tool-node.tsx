"use client";

import { Wrench } from "lucide-react";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import { NodeCard } from "./node-card";
import { NODE_THEMES, THEME } from "./themes";

export function ToolNode({ data, selected }: NodeProps<Node<OrchestraNodeData>>) {
  return (
    <NodeCard
      data={data}
      selected={selected}
      icon={Wrench}
      eyebrow="Tool"
      defaultLabel="External Tool"
      defaultSub={data.registryKey ?? "Callable capability"}
      theme={NODE_THEMES.tool}
      handles={[
        { id: "in", type: "target", position: Position.Top, color: THEME.toolHandle, label: "Agent" },
        { id: "out", type: "source", position: Position.Right, color: THEME.outputHandle, label: "Result" },
      ]}
    />
  );
}
