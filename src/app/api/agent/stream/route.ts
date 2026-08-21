import { db } from "@/db";
import {
  conversation as conversationTable,
  message as messageTable,
  project as projectTable,
} from "@/db/schema";
import { mainAgent } from "@/lib/ai/agents";
import { llm } from "@/lib/ai/models/llm";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

export const maxDuration = 180;

// conversationId 为空时创建新对话；clientMessageId 用于客户端请求幂等。
const requestSchema = z.object({
  message: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  conversationId: z.string().trim().min(1).optional(),
  clientMessageId: z.string().trim().min(1).optional(),
});

const encoder = new TextEncoder();

// 将事件编码为标准 SSE 数据帧。
function sse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function getConversationTitle(content: string) {
  return Array.from(content).slice(0, 50).join("");
}

export async function POST(req: Request) {
  try {
    // 所有项目、对话和消息操作都必须基于当前登录用户。
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return Response.json({ error: "用户未登录" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => null);
    const bodyResult = requestSchema.safeParse(rawBody);

    if (!bodyResult.success) {
      return Response.json(
        {
          error: "请求参数格式错误",
          issues: bodyResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { id: userId } = session.user;
    const {
      message: userContent,
      projectId,
      conversationId: requestedConversationId,
      clientMessageId,
    } = bodyResult.data;

    // 同时校验项目 ID 和所属用户，避免跨用户访问项目数据。
    const [existingProject] = await db
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(
        and(eq(projectTable.id, projectId), eq(projectTable.userId, userId)),
      )
      .limit(1);

    if (!existingProject) {
      return Response.json({ error: "项目不存在或无权访问" }, { status: 404 });
    }

    let conversationId = requestedConversationId;

    // 续聊时校验已有对话；首次聊天则自动创建对话。
    if (conversationId) {
      const [existingConversation] = await db
        .select({ id: conversationTable.id })
        .from(conversationTable)
        .where(
          and(
            eq(conversationTable.id, conversationId),
            eq(conversationTable.projectId, projectId),
            eq(conversationTable.userId, userId),
          ),
        )
        .limit(1);

      if (!existingConversation) {
        return Response.json(
          { error: "对话不存在或无权访问" },
          { status: 404 },
        );
      }
    } else {
      const [newConversation] = await db
        .insert(conversationTable)
        .values({
          projectId,
          userId,
          title: getConversationTitle(userContent),
        })
        .returning({ id: conversationTable.id });

      conversationId = newConversation.id;
    }

    // 原子写入用户消息和 Assistant 占位消息，避免只写入其中一条。
    const { userMessageId, assistantMessageId } = await db.transaction(
      async (tx) => {
        const [userMessage] = await tx
          .insert(messageTable)
          .values({
            conversationId,
            role: "user",
            content: userContent,
            status: "completed",
            clientMessageId,
          })
          .returning({ id: messageTable.id });

        const [assistantMessage] = await tx
          .insert(messageTable)
          .values({
            conversationId,
            role: "assistant",
            content: "",
            status: "streaming",
            model: llm.model,
          })
          .returning({ id: messageTable.id });

        await tx
          .update(conversationTable)
          .set({ updatedAt: new Date() })
          .where(
            and(
              eq(conversationTable.id, conversationId),
              eq(conversationTable.userId, userId),
            ),
          );

        return {
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
        };
      },
    );

    let streamingText = "";
    let reasoning = "";
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // 先返回数据库 ID，前端可据此创建并更新对应的消息气泡。
        controller.enqueue(
          sse("start", {
            conversationId,
            userMessageId,
            assistantMessageId,
          }),
        );

        try {
          // v3 事件流将模型文本和工具调用拆成独立投影，便于转换为自定义 SSE。
          const agentRun = await mainAgent.streamEvents(
            {
              messages: [{ role: "user", content: userContent }],
            },
            {
              configurable: { thread_id: conversationId }, // 当前对话的短期记忆
              context: { userId, projectId },
              signal: req.signal,
              version: "v3",
            },
          );

          await Promise.all([
            // 消费每次模型调用产生的正文、推理和 token 用量。
            (async () => {
              for await (const message of agentRun.messages) {
                await Promise.all([
                  (async () => {
                    for await (const delta of message.text) {
                      streamingText += delta;
                      controller.enqueue(
                        sse("message", {
                          messageId: assistantMessageId,
                          delta,
                        }),
                      );
                    }
                  })(),
                  (async () => {
                    for await (const delta of message.reasoning) {
                      reasoning += delta;
                      controller.enqueue(
                        sse("reasoning", {
                          messageId: assistantMessageId,
                          delta,
                        }),
                      );
                    }
                  })(),
                  (async () => {
                    for await (const usage of message.usage) {
                      inputTokens = (inputTokens ?? 0) + usage.input_tokens;
                      outputTokens = (outputTokens ?? 0) + usage.output_tokens;
                    }
                  })(),
                ]);
              }
            })(),
            // 工具调用开始和结束时发送同一种 tool 事件，由 status 区分状态。
            (async () => {
              for await (const call of agentRun.toolCalls) {
                controller.enqueue(
                  sse("tool", {
                    messageId: assistantMessageId,
                    toolCallId: call.callId,
                    name: call.name,
                    status: "running",
                  }),
                );

                try {
                  await call.output;

                  const [status, error] = await Promise.all([
                    call.status,
                    call.error,
                  ]);

                  controller.enqueue(
                    sse("tool", {
                      messageId: assistantMessageId,
                      toolCallId: call.callId,
                      name: call.name,
                      status: status === "finished" ? "completed" : "failed",
                      error,
                    }),
                  );
                } catch (error) {
                  controller.enqueue(
                    sse("tool", {
                      messageId: assistantMessageId,
                      toolCallId: call.callId,
                      name: call.name,
                      status: "failed",
                      error:
                        error instanceof Error ? error.message : "工具调用失败",
                    }),
                  );
                }
              }
            })(),
          ]);

          await agentRun.output;

          // 流结束后一次性保存完整内容，避免每个 token 都写数据库。
          await db.transaction(async (tx) => {
            await tx
              .update(messageTable)
              .set({
                content: streamingText,
                reasoning: reasoning || null,
                status: "completed",
                inputTokens,
                outputTokens,
                updatedAt: new Date(),
              })
              .where(eq(messageTable.id, assistantMessageId));

            await tx
              .update(conversationTable)
              .set({ updatedAt: new Date() })
              .where(
                and(
                  eq(conversationTable.id, conversationId),
                  eq(conversationTable.userId, userId),
                ),
              );
          });

          controller.enqueue(
            sse("end", {
              ok: true,
              conversationId,
              messageId: assistantMessageId,
            }),
          );
          controller.close();
        } catch (error) {
          // 失败或取消时仍保存已经生成的部分，方便恢复和排查。
          const aborted = req.signal.aborted;
          const errorMessage =
            error instanceof Error ? error.message : "Stream failed";

          console.error("Agent stream failed", error);

          try {
            await db
              .update(messageTable)
              .set({
                content: streamingText,
                reasoning: reasoning || null,
                status: aborted ? "cancelled" : "failed",
                error: aborted ? null : errorMessage,
                inputTokens,
                outputTokens,
                updatedAt: new Date(),
              })
              .where(eq(messageTable.id, assistantMessageId));
          } catch (persistenceError) {
            console.error(
              "Failed to persist assistant message state",
              persistenceError,
            );
          }

          if (!aborted) {
            try {
              controller.enqueue(
                sse("error", {
                  messageId: assistantMessageId,
                  error: "生成失败",
                }),
              );
            } catch {
              // 客户端可能已经断开连接。
            }
          }

          try {
            controller.close();
          } catch {
            // 客户端断开后，流可能已经关闭。
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Failed to start agent stream", error);

    return Response.json({ error: "请求失败" }, { status: 500 });
  }
}
