import { memo, useState } from "react";

import type { message as messageTable } from "@/db/schema";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Loader2,
  Wrench,
} from "lucide-react";
import { ConvertMarkdownToText } from "./convert-markdown-to-text";

type DbMessage = typeof messageTable.$inferSelect;

export type ToolCallStatus = "running" | "completed" | "failed";

export type ToolCallData = {
  id: string;
  name: string;
  status: ToolCallStatus;
  error?: string;
};

export type ChatMessageData = Pick<
  DbMessage,
  "id" | "role" | "content" | "reasoning" | "status" | "error"
> & {
  toolCalls?: ToolCallData[];
};

const toolLabels: Record<string, string> = {
  save_memory: "保存长期记忆",
  search_memory: "搜索长期记忆",
};

interface Props {
  message: ChatMessageData;
  loading: boolean;
}

export const ChatMessage = memo(function Message({ message, loading }: Props) {
  const isUser = message.role === "user";
  const [showThinking, setShowThinking] = useState(false);

  // 收到第一段正文时，自动收起已经展示过的推理过程。
  // useEffect(() => {
  //   if (!isUser && message.content.length > 0) {
  //     setShowThinking(false);
  //   }
  // }, [isUser, message.content]);

  return (
    <div
      className={cn(
        "relative rounded-2xl px-4 py-3 text-sm",
        isUser
          ? "max-w-[80%] rounded-br-sm bg-slate-200 text-gray-900 dark:bg-slate-800 dark:text-slate-100"
          : "max-w-full rounded-bl-sm text-slate-800 dark:text-slate-200",
      )}
    >
      {/* AI消息 */}
      {!isUser && (
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span>AI</span>
          {loading && (
            <Loader2
              aria-hidden="true"
              className="size-3 animate-spin text-blue-500 dark:text-blue-400"
            />
          )}
        </div>
      )}
      {/* 工具调用状态只展示名称和结果，不暴露工具参数及内部返回值。 */}
      {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {message.toolCalls.map((toolCall) => (
            <div
              key={toolCall.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                toolCall.status === "failed"
                  ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400"
                  : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
              )}
            >
              {toolCall.status === "running" ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
              ) : toolCall.status === "completed" ? (
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
              ) : (
                <CircleAlert className="size-3.5 shrink-0" />
              )}
              <Wrench className="size-3.5 shrink-0" />
              <span className="font-medium">
                {toolCall.status === "running"
                  ? "正在调用工具"
                  : toolCall.status === "completed"
                    ? "工具调用完成"
                    : "工具调用失败"}
              </span>
              <span className="truncate text-slate-400 dark:text-slate-500">
                {toolLabels[toolCall.name] ?? toolCall.name}
              </span>
            </div>
          ))}
        </div>
      )}
      {/* 深度思考展开/收缩按钮 */}
      {!isUser && message.reasoning && (
        <div className="mb-2">
          <button
            onClick={() => setShowThinking((v) => !v)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
          >
            {showThinking ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            Thinking
          </button>
          {showThinking && (
            <div className="mt-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              {message.reasoning}
            </div>
          )}
        </div>
      )}
      {/* 消息正文 - AI/用户 */}
      {isUser ? (
        <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
      ) : (
        <div className="prose prose-sm max-w-none text-sm leading-relaxed dark:prose-invert">
          <ConvertMarkdownToText text={message.content} />
        </div>
      )}
    </div>
  );
});
