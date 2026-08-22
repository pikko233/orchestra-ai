import { memo, useState } from "react";

import type { message as messageTable } from "@/db/schema";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { ConvertMarkdownToText } from "./convert-markdown-to-text";

type DbMessage = typeof messageTable.$inferSelect;

export type ChatMessageData = Pick<
  DbMessage,
  "id" | "role" | "content" | "reasoning" | "status" | "error"
>;

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
