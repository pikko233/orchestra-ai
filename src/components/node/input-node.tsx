"use client";

import { LogIn } from "lucide-react";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import { CompactIconNode } from "./compact-icon-node";
import { NODE_THEMES, THEME } from "./themes";

export function InputNode({ data, selected }: NodeProps<Node<OrchestraNodeData>>) {
  return (
    <CompactIconNode
      data={data}
      selected={selected}
      icon={<LogIn className="size-6" />}
      label="用户输入"
      theme={NODE_THEMES.input}
      handles={[
        { id: "out", type: "source", position: Position.Right, color: THEME.outputHandle, label: "Output" },
      ]}
    />
  );
}
