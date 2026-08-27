"use client";

import { Loader2, Send, Square } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { WorkflowSpec } from "@/lib/workflow/schema";
import { workflowRequiresWriteConfirmation } from "@/lib/workflow/schema";
import { useWorkflowRunner } from "../../hooks/use-workflow-runner";
import { MarkdownContent } from "./markdown-content";

interface Props {
  projectId: string;
  workflow: WorkflowSpec | null;
}

export function WorkflowExecutionPanel({ projectId, workflow }: Props) {
  const [input, setInput] = useState("");
  const [submittedInput, setSubmittedInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { run, stop, running, output, error, nodeStatuses, subAgents } =
    useWorkflowRunner(projectId);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [error, nodeStatuses, output, subAgents]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!workflow || !message || running) return;

    const writeConfirmed = workflowRequiresWriteConfirmation(workflow);
    if (
      writeConfirmed &&
      !window.confirm("该工作流可能发送邮件或创建日历事件，是否继续？")
    ) {
      return;
    }

    setSubmittedInput(message);
    setInput("");
    void run(message, writeConfirmed);
  };

  const statusEntries = Object.entries(nodeStatuses);
  const nodeLabels = new Map(
    workflow?.nodes.map((node) => [node.id, node.data.label]) ?? [],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-950">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5 [scrollbar-color:#94a3b8_transparent] scrollbar-thin dark:[scrollbar-color:#475569_transparent]"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          <span className="w-fit rounded-md bg-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {running ? "工作流运行中" : workflow ? "工作流已就绪" : "尚未创建工作流"}
          </span>

          {!submittedInput && (
            <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
              {workflow
                ? "工作流已准备好，请在下方输入要执行的任务。"
                : "请先在左侧创建一个工作流。"}
            </div>
          )}

          {submittedInput && (
            <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-slate-200 px-4 py-3 text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              {submittedInput}
            </div>
          )}

          {(statusEntries.length > 0 || subAgents.length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                执行进度
              </p>
              <div className="space-y-2 text-sm">
                {statusEntries.map(([nodeId, status]) => (
                  <div key={nodeId} className="flex justify-between gap-4">
                    <span className="truncate">{nodeLabels.get(nodeId) ?? nodeId}</span>
                    <RunStatus status={status} />
                  </div>
                ))}
                {subAgents.map((subAgent) => (
                  <div
                    key={`${subAgent.runId}:${subAgent.subAgentId}`}
                    className="flex justify-between gap-4"
                    title={subAgent.error}
                  >
                    <span className="truncate">
                      {subAgent.role} · {subAgent.modelName}
                    </span>
                    <RunStatus status={subAgent.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {output && (
            <div className="min-w-0 text-sm text-slate-700 dark:text-slate-200">
              <MarkdownContent text={output} />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-900">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            disabled={!workflow || running}
            rows={1}
            aria-label="工作流输入"
            placeholder={workflow ? "输入要执行的任务…" : "请先创建工作流"}
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:placeholder:text-slate-500"
          />
          {running ? (
            <button
              type="button"
              onClick={stop}
              aria-label="停止运行"
              className="rounded-lg bg-red-500 p-2.5 text-white hover:bg-red-600"
            >
              <Square size={15} className="fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!workflow || !input.trim()}
              aria-label="运行工作流"
              className="rounded-lg bg-blue-600 p-2.5 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function RunStatus({ status }: { status: string }) {
  const label =
    status === "success"
      ? "已完成"
      : status === "error"
        ? "失败"
        : status === "running"
          ? "运行中"
          : "等待中";

  return (
    <span
      className={
        status === "success"
          ? "shrink-0 text-emerald-600 dark:text-emerald-400"
          : status === "error"
            ? "shrink-0 text-red-600 dark:text-red-400"
            : "flex shrink-0 items-center gap-1 text-blue-600 dark:text-blue-400"
      }
    >
      {status === "running" && <Loader2 size={12} className="animate-spin" />}
      {label}
    </span>
  );
}
