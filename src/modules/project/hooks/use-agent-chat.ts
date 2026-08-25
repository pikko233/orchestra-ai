"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readSse } from "@/lib/sse";
import { parseAgentTodos } from "@/lib/ai/todos";
import {
  workflowSpecSchema,
  type WorkflowSpec,
} from "@/lib/workflow/schema";
import type { ChatMessageData } from "../ui/components/chat-message";

function getErrorMessage(value: unknown) {
  return value instanceof Error ? value.message : "请求失败，请稍后重试";
}

export function useAgentChat({
  projectId,
  onWorkflow,
}: {
  projectId: string;
  onWorkflow: (workflow: WorkflowSpec) => void;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
    abortRef.current?.abort();
    abortRef.current = null;
    setConversationId(undefined);
    setMessages([]);
    setInput("");
    setLoading(false);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || loading) return;

    const clientMessageId = crypto.randomUUID();
    let userMessageId = clientMessageId;
    let assistantMessageId: string | undefined;
    let receivedTerminalEvent = false;

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
    abortRef.current = abortController;

    try {
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          projectId,
          conversationId,
          clientMessageId,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : `请求失败（${response.status}）`;
        throw new Error(message);
      }

      if (!response.body) throw new Error("浏览器未收到流式响应");

      for await (const { event, data } of readSse(response.body)) {
        switch (event) {
          case "start": {
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
            userMessageId = nextUserMessageId;
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
            break;
          }
          case "message": {
            if (
              typeof data.messageId === "string" &&
              typeof data.delta === "string"
            ) {
              updateMessage(data.messageId, (message) => ({
                ...message,
                content: message.content + data.delta,
              }));
            }
            break;
          }
          case "reasoning": {
            if (
              typeof data.messageId === "string" &&
              typeof data.delta === "string"
            ) {
              updateMessage(data.messageId, (message) => ({
                ...message,
                reasoning: (message.reasoning ?? "") + data.delta,
              }));
            }
            break;
          }
          case "todos": {
            const todos = parseAgentTodos(data.todos);
            if (typeof data.messageId === "string" && todos) {
              updateMessage(data.messageId, (message) => ({
                ...message,
                todos,
              }));
            }
            break;
          }
          case "workflow": {
            const workflow = workflowSpecSchema.safeParse(data);
            if (workflow.success) onWorkflow(workflow.data);
            break;
          }
          case "end": {
            if (typeof data.messageId === "string") {
              updateMessage(data.messageId, (message) => ({
                ...message,
                status: "completed",
              }));
            }
            receivedTerminalEvent = true;
            break;
          }
          case "error": {
            if (typeof data.messageId === "string") {
              updateMessage(data.messageId, (message) => ({
                ...message,
                status: "failed",
                error:
                  typeof data.error === "string" ? data.error : "生成失败",
              }));
            }
            receivedTerminalEvent = true;
            break;
          }
        }

        if (receivedTerminalEvent) break;
      }

      if (!receivedTerminalEvent) throw new Error("流式连接意外中断");
    } catch (error) {
      if (abortController.signal.aborted) {
        if (assistantMessageId) {
          updateMessage(assistantMessageId, (message) => ({
            ...message,
            status: "cancelled",
          }));
        }
        return;
      }

      const errorMessage = getErrorMessage(error);
      if (assistantMessageId) {
        updateMessage(assistantMessageId, (message) => ({
          ...message,
          status: "failed",
          error: errorMessage,
        }));
      } else {
        updateMessage(userMessageId, (message) => ({
          ...message,
          status: "failed",
          error: errorMessage,
        }));
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
      if (abortRef.current === abortController) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, [conversationId, input, loading, onWorkflow, projectId, updateMessage]);

  return {
    input,
    setInput,
    messages,
    loading,
    sendMessage,
    startNewConversation,
  };
}
