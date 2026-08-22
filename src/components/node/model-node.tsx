"use client";

import { BrainCircuit } from "lucide-react";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import { NodeCard } from "./node-card";
import { NODE_THEMES, THEME } from "./themes";

export function ModelNode({ data, selected }: NodeProps<Node<OrchestraNodeData>>) {
  return (
    <NodeCard
      data={data}
      selected={selected}
      icon={BrainCircuit}
      eyebrow="Language Model"
      defaultLabel="LLM"
      defaultSub="Generative intelligence"
      theme={NODE_THEMES.model}
      handles={[
        { id: "in", type: "target", position: Position.Left, color: THEME.inputHandle, label: "Prompt" },
        { id: "out", type: "source", position: Position.Right, color: THEME.outputHandle, label: "Completion" },
      ]}
    />
  );
}
