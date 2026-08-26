"use client";

import type { CSSProperties, ReactNode } from "react";
import { Plus } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import type { NodeTheme } from "./themes";
import { THEME } from "./themes";

type CompactNodeHandle = {
  id: string;
  type: "source" | "target";
  position: Position;
  color: string;
  label: string;
};

type CompactIconNodeProps = {
  data: OrchestraNodeData;
  selected?: boolean;
  icon: ReactNode;
  label: string;
  theme: NodeTheme;
  handles: CompactNodeHandle[];
};

const positionStyle: Record<Position, CSSProperties> = {
  [Position.Left]: { left: -15, top: "50%" },
  [Position.Right]: { right: -15, top: "50%" },
  [Position.Top]: { top: -15, left: "50%" },
  [Position.Bottom]: { bottom: -15, left: "50%" },
};

export function CompactIconNode({
  data,
  selected = false,
  icon,
  label,
  theme,
  handles,
}: CompactIconNodeProps) {
  const status = data.status ?? (data.running ? "running" : "idle");
  const isRunning = status === "running";
  const statusColor = {
    idle: THEME.idle,
    running: THEME.active,
    success: "#22c55e",
    error: "#ef4444",
  }[status];
  return (
    <div className="relative flex w-28 flex-col items-center overflow-visible">
      <div
        className="relative flex size-16 items-center justify-center rounded-full border-2 border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.14)] transition-all duration-300 dark:border-slate-700 dark:bg-slate-950"
        style={{
          backgroundColor: theme.soft,
          borderColor:
            status === "error"
              ? statusColor
              : selected || isRunning
                ? theme.border
                : undefined,
          boxShadow:
            selected || isRunning
              ? `0 0 0 3px ${theme.soft}, 0 8px 24px rgba(15, 23, 42, 0.16)`
              : undefined,
          color: theme.accent,
        }}
      >
        <span
          aria-hidden="true"
          className={`text-2xl ${isRunning ? "animate-pulse" : ""}`}
        >
          {icon}
        </span>
        {handles.map((handle) => (
          <Handle
            key={`${handle.type}-${handle.id}`}
            type={handle.type}
            position={handle.position}
            id={handle.id}
            aria-label={handle.label}
            title={handle.label}
            className="nodrag nopan z-50! flex! size-7! items-center! justify-center! rounded-full! border-2! border-slate-300! bg-white! shadow-md! transition-transform! hover:scale-110! dark:border-slate-700! dark:bg-slate-800!"
            style={positionStyle[handle.position]}
          >
            <Plus
              className="size-3.5"
              style={{ color: handle.color }}
              strokeWidth={3}
            />
          </Handle>
        ))}
      </div>

      <p
        className="mt-2 max-w-28 truncate text-center text-xs font-semibold text-slate-700 dark:text-slate-200"
        title={label}
      >
        {label}
      </p>
    </div>
  );
}
