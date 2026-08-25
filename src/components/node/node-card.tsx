"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import type { OrchestraNodeData } from "@/lib/workflow/schema";
import type { NodeTheme } from "./themes";
import { THEME } from "./themes";

type NodeHandle = {
  id: string;
  type: "source" | "target";
  position: Position;
  color: string;
  label?: string;
};

type NodeCardProps = {
  data: OrchestraNodeData;
  selected?: boolean;
  icon: LucideIcon;
  eyebrow: string;
  defaultLabel: string;
  defaultSub: string;
  theme: NodeTheme;
  handles: NodeHandle[];
  footer?: ReactNode;
};

const positionStyle: Record<Position, CSSProperties> = {
  [Position.Left]: { left: -17, top: "50%" },
  [Position.Right]: { right: -17, top: "50%" },
  [Position.Top]: { top: -17, left: "50%" },
  [Position.Bottom]: { bottom: -17, left: "50%" },
};

export function NodeCard({
  data,
  selected = false,
  icon: Icon,
  eyebrow,
  defaultLabel,
  defaultSub,
  theme: nodeTheme,
  handles,
  footer,
}: NodeCardProps) {
  const status = data.status ?? (data.running ? "running" : "idle");
  const isRunning = status === "running";
  const statusColor = {
    idle: THEME.idle,
    running: THEME.active,
    success: "#22c55e",
    error: "#ef4444",
  }[status];
  const subtitle =
    data.sub ??
    data.description ??
    data.modelName ??
    data.provider ??
    defaultSub;

  return (
    <div
      className="relative min-w-60 overflow-visible rounded-md border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.14)] transition-all duration-300 dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_12px_32px_rgba(0,0,0,0.72)]!"
      style={{
        borderColor:
          status === "error"
            ? statusColor
            : selected || isRunning
              ? nodeTheme.border
              : undefined,
        boxShadow:
          selected || isRunning
            ? `0 0 0 2px ${nodeTheme.soft}, 0 12px 32px rgba(15, 23, 42, 0.16)`
            : undefined,
      }}
    >
      <div className="flex items-center justify-between rounded-t-md border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <div
            className="rounded p-1"
            style={{ backgroundColor: nodeTheme.soft }}
          >
            <Icon
              className={`h-3.5 w-3.5 ${isRunning ? "animate-pulse" : ""}`}
              style={{ color: nodeTheme.accent }}
            />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {eyebrow}
          </span>
        </div>
        <span
          aria-label={status}
          className={`h-2 w-2 rounded-full ${isRunning ? "animate-pulse" : ""}`}
          style={{ backgroundColor: statusColor }}
        />
      </div>

      <div className="p-5">
        <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {data.label ?? defaultLabel}
        </h3>
        <p
          className="mt-1 max-w-56 truncate text-xs font-medium text-slate-500 dark:text-slate-400"
          title={String(subtitle)}
        >
          {String(subtitle)}
        </p>
        {footer}
      </div>

      {handles.map((handle) => (
        <Handle
          key={`${handle.type}-${handle.id}`}
          type={handle.type}
          position={handle.position}
          id={handle.id}
          aria-label={handle.label ?? handle.id}
          title={handle.label ?? handle.id}
          className="nodrag nopan z-50! flex! h-8! w-8! items-center! justify-center! rounded-full! border-2! border-slate-300! bg-white! shadow-lg! transition-transform! hover:scale-110! dark:border-slate-700! dark:bg-slate-800!"
          style={positionStyle[handle.position]}
        >
          <Plus
            className="h-4 w-4"
            style={{ color: handle.color }}
            strokeWidth={3}
          />
        </Handle>
      ))}
    </div>
  );
}
