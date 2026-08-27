"use client";

import {
  Bot,
  BrainCircuit,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  workflowChatModelRegistry,
  workflowToolRegistry,
  type WorkflowNode,
} from "@/lib/workflow/schema";

type LibraryItem = {
  label: string;
  value?: string;
  create: () => WorkflowNode;
};

const nodeId = () => `node_${crypto.randomUUID().slice(0, 8)}`;
const toolLabels: Record<(typeof workflowToolRegistry)[number], string> = {
  search: "搜索",
  save_memory: "保存记忆",
  delegate_tasks: "动态任务委派",
  send_email: "发送邮件",
  google_calendar: "查询 Google 日历",
  create_calendar_event: "创建日历事件",
};

const groups: Array<{
  label: string;
  icon: LucideIcon;
  items: LibraryItem[];
}> = [
  {
    label: "节点",
    icon: Bot,
    items: [
      {
        label: "用户输入",
        create: () => ({
          id: nodeId(),
          type: "input",
          data: { label: "用户输入" },
        }),
      },
      {
        label: "Agent",
        create: () => ({
          id: nodeId(),
          type: "agent",
          data: { label: "Agent", sub: "任务协调与执行" },
        }),
      },
      {
        label: "Sub Agent",
        create: () => ({
          id: nodeId(),
          type: "subAgent",
          data: { label: "Sub Agent", sub: "执行委派任务" },
        }),
      },
    ],
  },
  {
    label: "模型",
    icon: BrainCircuit,
    items: workflowChatModelRegistry.map((modelName) => ({
      label: modelName,
      create: () => ({
        id: nodeId(),
        type: "model",
        data: { label: modelName, modelName },
      }),
    })),
  },
  {
    label: "工具",
    icon: Wrench,
    items: workflowToolRegistry.map((registryKey) => ({
      label: toolLabels[registryKey],
      value: registryKey,
      create: () => ({
        id: nodeId(),
        type: "tool",
        data: { label: toolLabels[registryKey], registryKey },
      }),
    })),
  },
];

export function WorkflowNodeLibrary({
  onAddNode,
}: {
  onAddNode: (node: WorkflowNode) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLowerCase();

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-950 ${isOpen ? "w-64" : "w-12"}`}
    >
      <div
        className={`flex h-12 shrink-0 items-center border-b border-slate-200 dark:border-slate-800 ${isOpen ? "justify-between px-4" : "justify-center"}`}
      >
        {isOpen && <h2 className="font-medium">节点库</h2>}
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          aria-label={isOpen ? "收起节点库" : "展开节点库"}
          title={isOpen ? "收起节点库" : "展开节点库"}
          className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          {isOpen ? (
            <PanelRightClose size={17} />
          ) : (
            <PanelRightOpen size={17} />
          )}
        </button>
      </div>

      {isOpen && (
        <label className="m-3 flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-500 focus-within:border-blue-500 dark:border-slate-700 dark:text-slate-400">
          <Search size={15} />
          <span className="sr-only">搜索节点</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索节点…"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </label>
      )}

      {isOpen && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {groups.map((group) => {
            const items = group.items.filter((item) =>
              `${item.label} ${item.value ?? ""}`
                .toLowerCase()
                .includes(keyword),
            );
            if (items.length === 0) return null;

            const Icon = group.icon;
            return (
              <section key={group.label} className="mb-5">
                <h3 className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Icon size={14} />
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.value ?? item.label}
                      onClick={() => onAddNode(item.create())}
                      className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/40"
                    >
                      <span className="block">{item.label}</span>
                      {item.value && (
                        <span className="mt-0.5 block truncate text-xs text-slate-400 dark:text-slate-500">
                          {item.value}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}
