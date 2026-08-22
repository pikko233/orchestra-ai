"use client";

import { Cpu } from "lucide-react";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import { NodeCard } from "./node-card";
import { NODE_THEMES, THEME } from "./themes";

export function AgentNode({ data, selected }: NodeProps<Node<OrchestraNodeData>>) {
  return (
    <NodeCard
      data={data}
      selected={selected}
      icon={Cpu}
      eyebrow="Manager Core"
      defaultLabel="System Orchestrator"
      defaultSub="Standard LLM Intelligence"
      theme={NODE_THEMES.agent}
      handles={[
        { id: "in", type: "target", position: Position.Left, color: THEME.inputHandle, label: "Input" },
        { id: "out", type: "source", position: Position.Right, color: THEME.outputHandle, label: "Output" },
        { id: "tools", type: "source", position: Position.Bottom, color: THEME.toolHandle, label: "Tools" },
      ]}
    />
  );
}
