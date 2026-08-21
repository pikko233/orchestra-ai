"use client";

import { Play, Sidebar } from "lucide-react";
import { useEffect, useState } from "react";
import { ProjectFindOne } from "../../types";
import { ProjectNameInput } from "../components/project-name-input";
import { ChatPanel } from "../components/chat-panel";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface Props {
  project: ProjectFindOne;
}

export const AIBuilder = ({ project }: Props) => {
  // Siderbar State
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(320);
  const [isDragging, setIsDragging] = useState(false);

  const router = useRouter();
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.isPending && !session.data?.user.id) {
      router.replace("/login");
    }
  }, [router, session.data?.user.id, session.isPending]);

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

          <div className="flex items-center gap-3 text-slate-600">
            <button className="bg-red-500 text-white p-1.5 rounded-md hover:bg-red-600">
              <Play size={18} className="fill-current" />
            </button>
          </div>
        </header>
      </main>
    </div>
  );
};
