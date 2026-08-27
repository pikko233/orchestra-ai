import { memo, useState } from "react";

import type { message as messageTable } from "@/db/schema";
import type { AgentTodo } from "@/lib/ai/todos";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, CircleAlert, Loader2 } from "lucide-react";
import { MarkdownContent } from "./markdown-content";
import type { ChatImage } from "@/lib/ai/images/types";

type DbMessage = typeof messageTable.$inferSelect;

export type ChatMessageData = Pick<
  DbMessage,
  "id" | "role" | "content" | "reasoning" | "status" | "error"
> & { todos?: AgentTodo[]; images?: ChatImage[] };

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
        "relative min-w-0 rounded-2xl px-4 py-3 text-sm",
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
      {message.images && message.images.length > 0 && (
        <div
          className={cn(
            "mb-2 grid gap-2 first:mt-0",
            message.images.length === 1
              ? "w-fit grid-cols-1"
              : "max-w-xl grid-cols-2",
          )}
        >
          {message.images.map((image) => (
            <a
              key={image.id}
              href={image.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
              title={image.filename}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.filename}
                loading="lazy"
                className="max-h-80 w-auto max-w-full object-contain"
              />
            </a>
          ))}
        </div>
      )}
      {/* 消息正文 - AI/用户 */}
      {isUser && message.content ? (
        <p className="break-words whitespace-pre-line leading-relaxed [overflow-wrap:anywhere]">
          {message.content}
        </p>
      ) : !isUser && message.content ? (
        <div className="prose prose-sm min-w-0 max-w-full overflow-hidden text-sm leading-relaxed dark:prose-invert">
          <MarkdownContent text={message.content} />
        </div>
      ) : null}
      {message.status === "failed" && message.error && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
        >
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          <span>{message.error}</span>
        </div>
      )}
    </div>
  );
});
