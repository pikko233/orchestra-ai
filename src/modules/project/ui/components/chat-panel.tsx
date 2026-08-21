"use client";

import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatInput } from "./chat-input";
import {
  ChatMessage,
  type ChatMessageData,
  type ToolCallData,
  type ToolCallStatus,
} from "./chat-message";
import { useRouter } from "next/navigation";

interface Props {
  chatWidth: number;
  projectId: string;
}

type ParsedSseEvent = {
  event: string;
  data: Record<string, unknown>;
};

// 解析一个以空行结尾的完整 SSE 事件帧。
function parseSseFrame(frame: string): ParsedSseEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    const data: unknown = JSON.parse(dataLines.join("\n"));

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    return { event, data: data as Record<string, unknown> };
  } catch {
    return null;
  }
}

function getErrorMessage(value: unknown) {
  if (value instanceof Error) {
    return value.message;
  }

  return "请求失败，请稍后重试";
}

function upsertToolCall(
  toolCalls: ToolCallData[] | undefined,
  nextToolCall: ToolCallData,
) {
  const current = toolCalls ?? [];
  const exists = current.some((toolCall) => toolCall.id === nextToolCall.id);

  return exists
    ? current.map((toolCall) =>
        toolCall.id === nextToolCall.id ? nextToolCall : toolCall,
      )
    : [...current, nextToolCall];
}

export const ChatPanel = ({ chatWidth, projectId }: Props) => {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [loading, setLoading] = useState(false);

  // 保存当前请求，便于新建对话或卸载组件时中止流式连接。
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 根据数据库消息 ID，只更新目标消息，避免覆盖其他消息状态。
  const updateMessage = useCallback(
    (
      messageId: string,
      update: (message: ChatMessageData) => ChatMessageData,
    ) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? update(message) : message,
        ),
      );
    },
    [],
  );

  const startNewConversation = useCallback(() => {
    // 新建对话前先停止仍在生成的回复。
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setConversationId(undefined);
    setMessages([]);
    setInput("");
    setLoading(false);
  }, []);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    // 消息增加或内容持续更新时，让视图跟随到最新位置。
    bottomRef.current?.scrollIntoView({
      behavior: loading ? "auto" : "smooth",
      block: "end",
    });
  }, [loading, messages]);

  const sendMessage = useCallback(async () => {
    const content = input.trim();

    if (!content || loading) {
      return;
    }

    const clientMessageId = crypto.randomUUID();
    let currentUserMessageId = clientMessageId;
    let assistantMessageId: string | undefined;
    let receivedTerminalEvent = false;

    // 先乐观展示用户消息，等 start 事件返回后再替换成数据库 ID。
    setInput("");
    setLoading(true);
    setMessages((current) => [
      ...current,
      {
        id: clientMessageId,
        role: "user",
        content,
        reasoning: null,
        status: "completed",
        error: null,
      },
    ]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          projectId,
          conversationId,
          clientMessageId,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const error =
          result &&
          typeof result === "object" &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : `请求失败（${response.status}）`;

        throw new Error(error);
      }

      if (!response.body) {
        throw new Error("浏览器未收到流式响应");
      }

      // Fetch 不会自动解析自定义 SSE，因此逐块读取并手动解码。
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // 流结束时，输出 TextDecoder 内部可能残留的字节。
          buffer += decoder.decode();
        } else {
          // stream: true 会暂存被网络分块截断的 UTF-8 字符。
          buffer += decoder.decode(value, { stream: true });
        }

        // SSE 事件由空行分隔；最后一段可能不完整，留到下一轮拼接。
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const parsed = parseSseFrame(frame);

          if (!parsed) {
            continue;
          }

          const { event, data } = parsed;

          if (event === "start") {
            // 建立客户端临时消息与数据库消息之间的 ID 对应关系。
            const nextConversationId = data.conversationId;
            const nextUserMessageId = data.userMessageId;
            const nextAssistantMessageId = data.assistantMessageId;

            if (
              typeof nextConversationId !== "string" ||
              typeof nextUserMessageId !== "string" ||
              typeof nextAssistantMessageId !== "string"
            ) {
              throw new Error("服务端返回了无效的消息 ID");
            }

            setConversationId(nextConversationId);
            currentUserMessageId = nextUserMessageId;
            assistantMessageId = nextAssistantMessageId;

            setMessages((current) => [
              ...current.map((message) =>
                message.id === clientMessageId
                  ? { ...message, id: nextUserMessageId }
                  : message,
              ),
              {
                id: nextAssistantMessageId,
                role: "assistant",
                content: "",
                reasoning: null,
                status: "streaming",
                error: null,
              },
            ]);
          }

          if (event === "message") {
            // 正文与 reasoning 分开累加，便于界面分别展示。
            const messageId = data.messageId;
            const delta = data.delta;

            if (typeof messageId === "string" && typeof delta === "string") {
              updateMessage(messageId, (message) => ({
                ...message,
                content: message.content + delta,
              }));
            }
          }

          if (event === "reasoning") {
            const messageId = data.messageId;
            const delta = data.delta;

            if (typeof messageId === "string" && typeof delta === "string") {
              updateMessage(messageId, (message) => ({
                ...message,
                reasoning: (message.reasoning ?? "") + delta,
              }));
            }
          }

          if (event === "tool") {
            const messageId = data.messageId;
            const toolCallId = data.toolCallId;
            const name = data.name;
            const status = data.status;

            if (
              typeof messageId === "string" &&
              typeof toolCallId === "string" &&
              typeof name === "string" &&
              (status === "running" ||
                status === "completed" ||
                status === "failed")
            ) {
              const toolCall: ToolCallData = {
                id: toolCallId,
                name,
                status: status as ToolCallStatus,
                error: typeof data.error === "string" ? data.error : undefined,
              };

              updateMessage(messageId, (message) => ({
                ...message,
                toolCalls: upsertToolCall(message.toolCalls, toolCall),
              }));
            }
          }

          if (event === "end") {
            const messageId = data.messageId;

            if (typeof messageId === "string") {
              updateMessage(messageId, (message) => ({
                ...message,
                status: "completed",
              }));
            }

            receivedTerminalEvent = true;
          }

          if (event === "error") {
            const messageId = data.messageId;
            const error =
              typeof data.error === "string" ? data.error : "生成失败";

            if (typeof messageId === "string") {
              updateMessage(messageId, (message) => ({
                ...message,
                status: "failed",
                error,
                toolCalls: message.toolCalls?.map((toolCall) =>
                  toolCall.status === "running"
                    ? { ...toolCall, status: "failed" as const, error }
                    : toolCall,
                ),
              }));
            }

            receivedTerminalEvent = true;
          }
        }

        if (done) {
          break;
        }
      }

      if (!receivedTerminalEvent) {
        // HTTP 流关闭不等于业务成功，必须收到 end 或 error 才算正常结束。
        throw new Error("流式连接意外中断");
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        // 主动取消和真实请求错误使用不同的消息状态。
        if (assistantMessageId) {
          updateMessage(assistantMessageId, (message) => ({
            ...message,
            status: "cancelled",
          }));
        }

        return;
      }

      const errorMessage = getErrorMessage(error);

      updateMessage(currentUserMessageId, (message) => ({
        ...message,
        status: "failed",
        error: errorMessage,
      }));

      if (assistantMessageId) {
        updateMessage(assistantMessageId, (message) => ({
          ...message,
          status: "failed",
          error: errorMessage,
        }));
      } else {
        setMessages((current) => [
          ...current,
          {
            id: `error-${clientMessageId}`,
            role: "assistant",
            content: errorMessage,
            reasoning: null,
            status: "failed",
            error: errorMessage,
          },
        ]);
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }

      setLoading(false);
    }
  }, [conversationId, input, loading, projectId, updateMessage]);

  return (
    <div
      style={{ width: `${chatWidth}px` }}
      className="flex h-full shrink-0 flex-col"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-slate-200 px-4 dark:border-slate-800">
        <Image
          className="dark:hidden cursor-pointer"
          src="/icons/logo.svg"
          alt="OrchestraAI"
          width={120}
          height={20}
          onClick={() => router.push("/project")}
        />
        <Image
          className="hidden dark:block cursor-pointer"
          src="/icons/logo-dark.svg"
          alt="OrchestraAI"
          width={120}
          height={20}
          onClick={() => router.push("/project")}
        />
      </div>

      <div className="flex shrink-0 justify-end gap-2 p-3 text-slate-500 dark:text-slate-400">
        <button
          type="button"
          onClick={startNewConversation}
          className="rounded-md p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="新建对话"
          title="新建对话"
        >
          <Plus size={18} />
        </button>
      </div>

      <div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-color:#94a3b8_#fff] scrollbar-thin dark:[scrollbar-color:#475569_#020617]",
        )}
      >
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
              message.role === "user" ? "justify-end" : "justify-start",
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

      <ChatInput
        input={input}
        setInput={setInput}
        sendMessage={sendMessage}
        loading={loading}
      />
    </div>
  );
};
