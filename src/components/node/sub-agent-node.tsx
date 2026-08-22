"use client";

import { Bot } from "lucide-react";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import { NodeCard } from "./node-card";
import { NODE_THEMES, THEME } from "./themes";

export function SubAgentNode({ data, selected }: NodeProps<Node<OrchestraNodeData>>) {
  return (
    <NodeCard
      data={data}
      selected={selected}
      icon={Bot}
      eyebrow="Sub Agent"
      defaultLabel="Specialist Agent"
      defaultSub="Delegated intelligence"
      theme={NODE_THEMES.subAgent}
      handles={[
        { id: "in", type: "target", position: Position.Left, color: THEME.inputHandle, label: "Task" },
        { id: "out", type: "source", position: Position.Right, color: THEME.outputHandle, label: "Result" },
        { id: "tools", type: "source", position: Position.Bottom, color: THEME.toolHandle, label: "Tools" },
      ]}
    />
  );
}
