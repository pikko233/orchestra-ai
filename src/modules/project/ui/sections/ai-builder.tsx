"use client";

import { Save, Sidebar } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/components/ui/toast";
import type {
  WorkflowNode,
  WorkflowSpec,
  WorkflowUpdate,
} from "@/lib/workflow/schema";
import { useTRPC } from "@/trpc/client";
import type { ProjectFindOne } from "../../types";
import { ChatPanel } from "../components/chat-panel";
import { ProjectNameInput } from "../components/project-name-input";
import {
  WorkflowCanvas,
  type WorkflowCanvasHandle,
} from "../components/workflow-canvas";
import { WorkflowExecutionPanel } from "../components/workflow-execution-panel";
import { WorkflowNodeLibrary } from "../components/workflow-node-library";
import { WorkflowScheduleManager } from "../components/workflow-schedule-manager";

interface Props {
  project: ProjectFindOne;
}

export const AIBuilder = ({ project }: Props) => {
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(320);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<"editor" | "execution">("editor");
  const [workflow, setWorkflow] = useState<WorkflowSpec | null>(
    project.workflow,
  );
  const [revision, setRevision] = useState(project.revision);
  const [isDirty, setIsDirty] = useState(false);
  const canvasRef = useRef<WorkflowCanvasHandle | null>(null);
  const router = useRouter();
  const session = authClient.useSession();
  const trpc = useTRPC();
  const saveWorkflow = useMutation(trpc.workflow.save.mutationOptions());

  useEffect(() => {
    if (!session.isPending && !session.data?.user.id) {
      router.replace("/login");
    }
  }, [router, session.data?.user.id, session.isPending]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      setChatWidth(Math.max(250, Math.min(event.clientX, 600)));
    };
    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "auto";
    };
  }, [isDragging]);

  const handleWorkflowChange = useCallback((next: WorkflowSpec) => {
    setWorkflow(next);
    setIsDirty(true);
  }, []);

  const handleChatWorkflow = useCallback((update: WorkflowUpdate) => {
    setWorkflow(update.workflow);
    setRevision(update.revision);
    setIsDirty(false);
  }, []);

  const handleAddNode = useCallback((node: WorkflowNode) => {
    setMode("editor");
    requestAnimationFrame(() => {
      const positions = canvasRef.current?.getNodePositions() ?? {};
      const position = canvasRef.current?.getRandomCenterPosition() ?? {
        x: 0,
        y: 0,
      };
      setWorkflow((current) => {
        const base = current ?? { version: 1, nodes: [], connections: [] };
        return {
          ...base,
          nodes: [
            ...base.nodes.map((item) =>
              positions[item.id]
                ? { ...item, position: positions[item.id] }
                : item,
            ),
            { ...node, position },
          ],
        };
      });
      setIsDirty(true);
    });
  }, []);

  const handleSave = () => {
    if (!workflow) return;

    const request = saveWorkflow
      .mutateAsync({
        projectId: project.id,
        workflow,
        expectedRevision: revision,
      })
      .then((result) => {
        setWorkflow(result.workflow);
        setRevision(result.revision);
        setIsDirty(false);
        return result;
      });

    toast.promise(request, {
      loading: "正在保存工作流…",
      success: "工作流已保存",
      error: "工作流保存失败",
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside
        style={{ width: isChatOpen ? chatWidth : 0 }}
        className={`relative flex h-full shrink-0 flex-col overflow-hidden border-slate-200 transition-[width] dark:border-slate-800 ${isChatOpen ? "border-r" : "border-0"}`}
      >
        <ChatPanel
          key={project.id}
          chatWidth={chatWidth}
          projectId={project.id}
          onWorkflow={handleChatWorkflow}
        />
        {isChatOpen && (
          <div
            onMouseDown={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize hover:bg-slate-200 dark:hover:bg-slate-700"
          />
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-slate-200 px-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setIsChatOpen((open) => !open)}
            aria-label={isChatOpen ? "关闭 AI Chat" : "打开 AI Chat"}
            title={isChatOpen ? "关闭 AI Chat" : "打开 AI Chat"}
            className={`mr-4 rounded-md p-1.5 transition-colors ${
              isChatOpen
                ? "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                : "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
            }`}
          >
            <Sidebar size={18} />
          </button>
          <ProjectNameInput projectId={project.id} projectName={project.name} />
        </header>

        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            <nav
              aria-label="工作区模式"
              className="flex h-12 shrink-0 items-end gap-6 border-b border-slate-200 px-5 dark:border-slate-800"
            >
              <ModeTab
                active={mode === "editor"}
                onClick={() => setMode("editor")}
              >
                虚拟画布
              </ModeTab>
              <ModeTab
                active={mode === "execution"}
                onClick={() => setMode("execution")}
              >
                执行工作流
              </ModeTab>
              <div className="ml-auto" />
              <WorkflowScheduleManager projectId={project.id} />
              <button
                type="button"
                onClick={handleSave}
                disabled={!workflow || !isDirty || saveWorkflow.isPending}
                className="mb-2 flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save size={15} />
                {saveWorkflow.isPending ? "保存中" : "保存"}
              </button>
            </nav>

            <div className="min-h-0 flex-1">
              <div className={mode === "editor" ? "h-full" : "hidden"}>
                <WorkflowCanvas
                  canvasRef={canvasRef}
                  workflow={workflow}
                  nodeStatuses={{}}
                  onWorkflowChange={handleWorkflowChange}
                />
              </div>
              <div className={mode === "execution" ? "h-full" : "hidden"}>
                <WorkflowExecutionPanel
                  projectId={project.id}
                  workflow={workflow}
                />
              </div>
            </div>
          </section>

          <WorkflowNodeLibrary onAddNode={handleAddNode} />
        </div>
      </main>
    </div>
  );
};

function ModeTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`h-full border-b-2 px-1 text-sm transition-colors ${
        active
          ? "border-blue-500 text-slate-900 dark:text-slate-100"
          : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
