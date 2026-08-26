"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MessageCirclePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowSpec } from "@/lib/workflow/schema";
import { useAgentChat } from "../../hooks/use-agent-chat";
import { AgentTodoList } from "./agent-todo-list";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  chatWidth: number;
  projectId: string;
  onWorkflow: (workflow: WorkflowSpec) => void;
}

export const ChatPanel = ({ chatWidth, projectId, onWorkflow }: Props) => {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const {
    input,
    setInput,
    messages,
    loading,
    sendMessage,
    startNewConversation,
  } = useAgentChat({ projectId, onWorkflow });
  const latestMessage = messages.at(-1);
  const activeTodos =
    latestMessage?.role === "assistant" ? latestMessage.todos : undefined;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: loading ? "auto" : "smooth",
      block: "end",
    });
  }, [loading, messages]);

  return (
    <div
      style={{ width: `${chatWidth}px` }}
      className="flex h-full shrink-0 flex-col"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-slate-200 px-4 dark:border-slate-800">
        <Tooltip>
          <TooltipTrigger
            aria-label="返回项目列表"
            className="cursor-pointer"
            onClick={() => router.push("/project")}
          >
            <Image
              className="dark:hidden"
              src="/icons/logo.svg"
              alt="OrchestraAI"
              width={120}
              height={20}
            />
            <Image
              className="hidden dark:block"
              src="/icons/logo-dark.svg"
              alt="OrchestraAI"
              width={120}
              height={20}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>点击返回首页</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex shrink-0 justify-end gap-2 p-3 text-slate-500 dark:text-slate-400">
        <button
          type="button"
          onClick={startNewConversation}
          className="rounded-md p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="新建对话"
          title="新建对话"
        >
          <MessageCirclePlus size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-4 [scrollbar-color:#94a3b8_#fff] scrollbar-thin dark:[scrollbar-color:#475569_#020617]">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400 dark:text-slate-500">
            输入消息，开始创建你的 Agent 工作流。
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end mr-4" : "justify-start",
            )}
          >
            <ChatMessage
              message={message}
              loading={message.status === "streaming"}
            />
          </div>
        ))}

        <div ref={bottomRef} className="h-px" />
      </div>

      <div className="relative shrink-0 p-4 pt-0">
        {activeTodos && activeTodos.length > 0 && (
          <div className="px-2 absolute bottom-full left-[5%] w-[90%]">
            <AgentTodoList
              todos={activeTodos}
              active={latestMessage?.status === "streaming"}
            />
          </div>
        )}

        <ChatInput
          input={input}
          setInput={setInput}
          sendMessage={sendMessage}
          loading={loading}
        />
      </div>
    </div>
  );
};
