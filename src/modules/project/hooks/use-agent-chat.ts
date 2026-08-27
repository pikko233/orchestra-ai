"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readSse } from "@/lib/sse";
import { parseAgentTodos } from "@/lib/ai/todos";
import {
  workflowSpecSchema,
  type WorkflowSpec,
} from "@/lib/workflow/schema";
import type { ChatMessageData } from "../ui/components/chat-message";
import {
  ALLOWED_IMAGE_TYPES,
  chatImageSchema,
  MAX_CHAT_IMAGES,
  MAX_UPLOAD_IMAGE_BYTES,
  type ChatImage,
  type PendingChatImage,
} from "@/lib/ai/images/types";
import { uploadFiles } from "@/lib/uploadthing";

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
  const [pendingImages, setPendingImages] = useState<PendingChatImage[]>([]);
  const [attachmentError, setAttachmentError] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);
  const pendingImagesRef = useRef<PendingChatImage[]>([]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  const clearPendingImages = useCallback(() => {
    for (const image of pendingImagesRef.current) {
      URL.revokeObjectURL(image.previewUrl);
    }
    pendingImagesRef.current = [];
    setPendingImages([]);
    setAttachmentError(undefined);
  }, []);

  const addImages = useCallback(
    (files: File[]) => {
      setAttachmentError(undefined);
      const available = MAX_CHAT_IMAGES - pendingImages.length;
      const selected = files.slice(0, available);
      const valid = selected.filter((file) => {
        if (
          !ALLOWED_IMAGE_TYPES.includes(
            file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
          )
        ) {
          setAttachmentError("仅支持 PNG、JPEG 和 WebP 图片");
          return false;
        }
        if (file.size === 0 || file.size > MAX_UPLOAD_IMAGE_BYTES) {
          setAttachmentError("单张图片大小不能超过 4MB");
          return false;
        }
        return true;
      });
      if (files.length > available) {
        setAttachmentError(`每次最多发送 ${MAX_CHAT_IMAGES} 张图片`);
      }
      setPendingImages((current) => [
        ...current,
        ...valid.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]);
    },
    [pendingImages.length],
  );

  const removeImage = useCallback((id: string) => {
    setPendingImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((image) => image.id !== id);
    });
    setAttachmentError(undefined);
  }, []);

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
    clearPendingImages();
  }, [clearPendingImages]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      for (const image of pendingImagesRef.current) {
        URL.revokeObjectURL(image.previewUrl);
      }
    },
    [],
  );

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if ((!content && pendingImages.length === 0) || loading) return;

    const clientMessageId = crypto.randomUUID();
    let userMessageId = clientMessageId;
    let assistantMessageId: string | undefined;
    let receivedTerminalEvent = false;
    let messageAdded = false;

    setLoading(true);
    setAttachmentError(undefined);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      let uploadedImages: ChatImage[] = [];
      if (pendingImages.length > 0) {
        const uploaded = await uploadFiles("chatImage", {
          files: pendingImages.map((image) => image.file),
          input: { projectId },
          signal: abortController.signal,
        });
        const parsed = chatImageSchema.array().safeParse(
          uploaded.map((file) => ({
            id: file.key,
            filename: file.name,
            mimeType: file.type,
            source: "upload",
            url: file.ufsUrl,
          })),
        );
        if (!parsed.success) throw new Error("图片上传接口返回格式错误");
        uploadedImages = parsed.data;
      }

      setInput("");
      clearPendingImages();
      setMessages((current) => [
        ...current,
        {
          id: clientMessageId,
          role: "user",
          content,
          reasoning: null,
          status: "completed",
          error: null,
          images: uploadedImages,
        },
      ]);
      messageAdded = true;

      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          projectId,
          conversationId,
          clientMessageId,
          images: uploadedImages,
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
          case "artifact": {
            const image = chatImageSchema.safeParse(data.image);
            if (typeof data.messageId === "string" && image.success) {
              updateMessage(data.messageId, (message) => ({
                ...message,
                images: [...(message.images ?? []), image.data],
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
      if (!messageAdded) {
        setAttachmentError(errorMessage);
        return;
      }
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
  }, [
    clearPendingImages,
    conversationId,
    input,
    loading,
    onWorkflow,
    pendingImages,
    projectId,
    updateMessage,
  ]);

  return {
    input,
    setInput,
    messages,
    loading,
    pendingImages,
    attachmentError,
    addImages,
    removeImage,
    sendMessage,
    startNewConversation,
  };
}
