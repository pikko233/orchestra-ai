"use client";

import { Plus, Wrench } from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import { NODE_THEMES, THEME } from "./themes";

export function ToolNode({ data, selected }: NodeProps<Node<OrchestraNodeData>>) {
  const status = data.status ?? (data.running ? "running" : "idle");
  const isActive = selected || status === "running";
  const toolName = data.registryKey ?? data.label ?? "未配置工具";

  return (
    <div
      className="relative flex h-14 w-56 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition-all dark:border-slate-800 dark:bg-slate-950"
      style={{
        borderColor:
          status === "error"
            ? "#ef4444"
            : isActive
              ? NODE_THEMES.tool.border
              : undefined,
        boxShadow: isActive
          ? `0 0 0 2px ${NODE_THEMES.tool.soft}, 0 8px 24px rgba(15,23,42,0.14)`
          : undefined,
      }}
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{
          color: NODE_THEMES.tool.accent,
          backgroundColor: NODE_THEMES.tool.soft,
        }}
      >
        <Wrench className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Tool
        </span>
        <span
          className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
          title={toolName}
        >
          {toolName}
        </span>
      </span>

      <Handle
        type="target"
        position={Position.Top}
        id="in"
        aria-label="Agent"
        title="Agent"
        className="nodrag nopan z-50! flex! size-7! items-center! justify-center! rounded-full! border-2! border-slate-300! bg-white! shadow-md! transition-transform! hover:scale-110! dark:border-slate-700! dark:bg-slate-800!"
        style={{ top: -15, left: "50%" }}
      >
        <Plus
          className="size-3.5"
          style={{ color: THEME.toolHandle }}
          strokeWidth={3}
        />
      </Handle>
    </div>
  );
}
