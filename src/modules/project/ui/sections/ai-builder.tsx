"use client";

import { Loader2, Maximize2, Minimize2, Play, Sidebar } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProjectFindOne } from "../../types";
import { ProjectNameInput } from "../components/project-name-input";
import { ChatPanel } from "../components/chat-panel";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import type { WorkflowSpec } from "@/lib/workflow/schema";
import { WorkflowCanvas } from "../components/workflow-canvas";
import { useWorkflowRunner } from "../../hooks/use-workflow-runner";
import { MarkdownContent } from "../components/markdown-content";

interface Props {
  project: ProjectFindOne;
}

export const AIBuilder = ({ project }: Props) => {
  // Siderbar State
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(320);
  const [isDragging, setIsDragging] = useState(false);
  const [workflow, setWorkflow] = useState<WorkflowSpec | null>(
    project.workflow,
  );
  const [workflowInput, setWorkflowInput] = useState("");
  const [isOutputExpanded, setIsOutputExpanded] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const { run, running, output, error, nodeStatuses, subAgents } =
    useWorkflowRunner(project.id);

  const router = useRouter();
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.isPending && !session.data?.user.id) {
      router.replace("/login");
    }
  }, [router, session.data?.user.id, session.isPending]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [isOutputExpanded, output]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newWidth = Math.max(250, Math.min(e.clientX, 600));

      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none"; // 防止拖拽时误选中文字
    } else {
      document.body.style.userSelect = "auto";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "auto";
    };
  }, [isDragging]);

  return (
    <div className="flex h-screen w-full overflow-y-auto bg-white font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* 左侧边栏 - chat聊天界面 */}
      <aside
        style={{ width: isChatOpen ? `${chatWidth}px` : "0px" }}
        className={`relative flex h-full shrink-0 flex-col overflow-hidden border-slate-200 dark:border-slate-800 ${isChatOpen ? "border" : "border-0"} ${isDragging ? "transition-[width] duration-300 ease-in-out" : ""}`}
      >
        <ChatPanel
          key={project.id}
          chatWidth={chatWidth}
          projectId={project.id}
          onWorkflow={setWorkflow}
        />
        {/* 点击拖拽调整左右两侧宽度 */}
        {isChatOpen && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-slate-200 dark:hover:bg-slate-700"
          />
        )}
      </aside>
      {/* ================= main区域 - 画布 ================= */}
      <main className={`flex-1 flex flex-col min-w-0 h-full`}>
        {/* Top Header */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <div className="flex items-center gap-4">
            {/* 控制侧边栏展开/隐藏的按钮 */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                isChatOpen
                  ? "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
              }`}
              title={isChatOpen ? "关闭侧边栏" : "打开侧边栏"}
            >
              <Sidebar size={18} />
            </button>
            {/* 项目名称 - 点击修改 */}
            <ProjectNameInput
              projectId={project.id}
              projectName={project.name}
            />
          </div>

          <div className="flex items-center gap-2 text-slate-600">
            <input
              value={workflowInput}
              onChange={(event) => setWorkflowInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                if (!workflow || running) return;
                void run(workflowInput);
              }}
              aria-label="工作流输入"
              placeholder="输入要交给工作流处理的内容"
              className="h-8 w-72 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => void run(workflowInput)}
              disabled={!workflow || !workflowInput.trim() || running}
              aria-label={running ? "工作流运行中" : "运行工作流"}
              title={workflow ? "运行工作流" : "请先创建工作流"}
              className="rounded-md bg-red-500 p-1.5 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Play size={18} className="fill-current" />
              )}
            </button>
          </div>
        </header>
        <div className="relative min-h-0 flex-1">
          <WorkflowCanvas workflow={workflow} nodeStatuses={nodeStatuses} />
          {(output || error || subAgents.length > 0) && (
            <div
              className={`absolute z-10 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white/95 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900/95 ${
                isOutputExpanded
                  ? "inset-4"
                  : "right-4 bottom-4 h-36 w-[min(24rem,calc(100%-2rem))]"
              }`}
            >
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-700">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  工作流输出
                </span>
                <button
                  type="button"
                  onClick={() => setIsOutputExpanded((current) => !current)}
                  aria-expanded={isOutputExpanded}
                  aria-label={
                    isOutputExpanded ? "收缩工作流输出" : "展开工作流输出"
                  }
                  title={isOutputExpanded ? "收缩" : "展开"}
                  className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  {isOutputExpanded ? (
                    <Minimize2 size={16} />
                  ) : (
                    <Maximize2 size={16} />
                  )}
                </button>
              </div>
              <div
                ref={outputRef}
                className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-color:#94a3b8_transparent] scrollbar-thin dark:[scrollbar-color:#475569_transparent]"
              >
                {subAgents.length > 0 && (
                  <div className="mb-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      临时 Sub Agents
                    </p>
                    {subAgents.map((subAgent) => (
                      <div
                        key={`${subAgent.runId}:${subAgent.subAgentId}`}
                        title={subAgent.error}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="truncate text-slate-700 dark:text-slate-200">
                          {subAgent.role} · {subAgent.modelName}
                        </span>
                        <span
                          className={
                            subAgent.status === "success"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : subAgent.status === "error"
                                ? "text-red-600 dark:text-red-400"
                                : "text-blue-600 dark:text-blue-400"
                          }
                        >
                          {subAgent.status === "success"
                            ? "已完成"
                            : subAgent.status === "error"
                              ? "失败"
                              : "运行中"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {error ? (
                  <p role="alert" className="text-red-600 dark:text-red-400">
                    {error}
                  </p>
                ) : (
                  <div className="text-slate-700 dark:text-slate-200">
                    <MarkdownContent text={output} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
