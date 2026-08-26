"use client";

import { BsOpenai } from "react-icons/bs";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import { CompactIconNode } from "./compact-icon-node";
import { NODE_THEMES, THEME } from "./themes";

export function ModelNode({ data, selected }: NodeProps<Node<OrchestraNodeData>>) {
  return (
    <CompactIconNode
      data={data}
      selected={selected}
      icon={<BsOpenai className="size-7" />}
      label={data.modelName ?? "未配置模型"}
      theme={NODE_THEMES.model}
      handles={[
        { id: "in", type: "target", position: Position.Left, color: THEME.inputHandle, label: "Prompt" },
      ]}
    />
  );
}
