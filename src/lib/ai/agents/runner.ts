import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  conversation as conversationTable,
  message as messageTable,
  project as projectTable,
} from "@/db/schema";
import { workflowSpecSchema } from "@/lib/workflow/schema";
import { parseAgentTodos, type AgentTodo } from "@/lib/ai/todos";
import { llm } from "../models/llm";
import { streamAgent } from ".";

export class AgentRunNotFoundError extends Error {}

export type AgentStreamEvent = {
  type:
    | "start"
    | "message"
    | "reasoning"
    | "todos"
    | "tool"
    | "workflow"
    | "end"
    | "error";
  data: unknown;
};

type AgentOutput = {
  text: string;
  reasoning: string;
  todos: AgentTodo[];
  inputTokens?: number;
  outputTokens?: number;
};

async function consume<T>(
  source: AsyncIterable<T>,
  onValue: (value: T) => void | Promise<void>,
) {
  for await (const value of source) await onValue(value);
}

function parseWorkflow(output: unknown) {
  if (typeof output !== "string") return workflowSpecSchema.safeParse(output);

  try {
    return workflowSpecSchema.safeParse(JSON.parse(output));
  } catch {
    return workflowSpecSchema.safeParse(null);
  }
}

async function getConversationId({
  conversationId,
  projectId,
  userId,
  message,
}: {
  conversationId?: string;
  projectId: string;
  userId: string;
  message: string;
}) {
  if (!conversationId) {
    const [created] = await db
      .insert(conversationTable)
      .values({
        projectId,
        userId,
        title: Array.from(message).slice(0, 50).join(""),
      })
      .returning({ id: conversationTable.id });
    return created.id;
  }

  const [existing] = await db
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

  if (!existing) {
    throw new AgentRunNotFoundError("对话不存在或无权访问");
  }

  return existing.id;
}

export async function prepareAgentRun({
  userId,
  projectId,
  message,
  conversationId: requestedConversationId,
  clientMessageId,
}: {
  userId: string;
  projectId: string;
  message: string;
  conversationId?: string;
  clientMessageId?: string;
}) {
  const [project] = await db
    .select({
      workflow: projectTable.workflow,
      revision: projectTable.revision,
    })
    .from(projectTable)
    .where(and(eq(projectTable.id, projectId), eq(projectTable.userId, userId)))
    .limit(1);

  if (!project) {
    throw new AgentRunNotFoundError("项目不存在或无权访问");
  }

  const conversationId = await getConversationId({
    conversationId: requestedConversationId,
    projectId,
    userId,
    message,
  });

  const { userMessageId, assistantMessageId } = await db.transaction(
    async (tx) => {
      const [userMessage] = await tx
        .insert(messageTable)
        .values({
          conversationId,
          role: "user",
          content: message,
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
        .where(eq(conversationTable.id, conversationId));

      return {
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      };
    },
  );

  return {
    userId,
    projectId,
    message,
    conversationId,
    userMessageId,
    assistantMessageId,
    workflow: project.workflow,
    revision: project.revision,
  };
}

type PreparedAgentRun = Awaited<ReturnType<typeof prepareAgentRun>>;

async function saveAssistant(
  run: PreparedAgentRun,
  output: AgentOutput,
  status: "completed" | "cancelled" | "failed",
  error?: string,
) {
  await db.transaction(async (tx) => {
    await tx
      .update(messageTable)
      .set({
        content: output.text,
        reasoning: output.reasoning || null,
        status,
        error: error ?? null,
        inputTokens: output.inputTokens,
        outputTokens: output.outputTokens,
        metadata: output.todos.length > 0 ? { todos: output.todos } : null,
        updatedAt: new Date(),
      })
      .where(eq(messageTable.id, run.assistantMessageId));

    await tx
      .update(conversationTable)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(conversationTable.id, run.conversationId),
          eq(conversationTable.userId, run.userId),
        ),
      );
  });
}

export async function runPreparedAgent(
  run: PreparedAgentRun,
  emit: (event: AgentStreamEvent) => void,
  signal: AbortSignal,
) {
  const output: AgentOutput = { text: "", reasoning: "", todos: [] };

  emit({
    type: "start",
    data: {
      conversationId: run.conversationId,
      userMessageId: run.userMessageId,
      assistantMessageId: run.assistantMessageId,
    },
  });

  try {
    const agentRun = await streamAgent.streamEvents(
      {
        messages: [
          {
            role: "system",
            content: `当前项目工作流（revision ${run.revision}）：\n${JSON.stringify(run.workflow)}`,
          },
          { role: "user", content: run.message },
        ],
        todos: [],
      },
      {
        configurable: { thread_id: run.conversationId },
        context: {
          userId: run.userId,
          projectId: run.projectId,
          revision: run.revision,
        },
        recursionLimit: 50,
        signal,
        version: "v3",
      },
    );

    const consumeMessages = async () => {
      for await (const message of agentRun.messages) {
        await Promise.all([
          consume(message.text, (delta) => {
            output.text += delta;
            emit({
              type: "message",
              data: { messageId: run.assistantMessageId, delta },
            });
          }),
          consume(message.reasoning, (delta) => {
            output.reasoning += delta;
            emit({
              type: "reasoning",
              data: { messageId: run.assistantMessageId, delta },
            });
          }),
          consume(message.usage, (usage) => {
            output.inputTokens =
              (output.inputTokens ?? 0) + usage.input_tokens;
            output.outputTokens =
              (output.outputTokens ?? 0) + usage.output_tokens;
          }),
        ]);
      }
    };

    const consumeTools = async () => {
      for await (const call of agentRun.toolCalls) {
        emit({
          type: "tool",
          data: {
            messageId: run.assistantMessageId,
            toolCallId: call.callId,
            name: call.name,
            status: "running",
          },
        });

        try {
          const toolOutput = await call.output;
          const [status, error] = await Promise.all([call.status, call.error]);

          emit({
            type: "tool",
            data: {
              messageId: run.assistantMessageId,
              toolCallId: call.callId,
              name: call.name,
              status: status === "finished" ? "completed" : "failed",
              error,
            },
          });

          if (call.name === "replace_workflow") {
            const workflow = parseWorkflow(toolOutput);
            if (workflow.success) {
              emit({ type: "workflow", data: workflow.data });
            }
          }
        } catch (error) {
          emit({
            type: "tool",
            data: {
              messageId: run.assistantMessageId,
              toolCallId: call.callId,
              name: call.name,
              status: "failed",
              error: error instanceof Error ? error.message : "工具调用失败",
            },
          });
        }
      }
    };

    const consumeTodos = async () => {
      let previous = "";
      for await (const state of agentRun.values) {
        const todos = parseAgentTodos(state.todos);
        if (!todos) continue;

        const current = JSON.stringify(todos);
        if (current === previous) continue;
        previous = current;
        output.todos = todos;
        emit({
          type: "todos",
          data: { messageId: run.assistantMessageId, todos },
        });
      }
    };

    await Promise.all([consumeMessages(), consumeTools(), consumeTodos()]);
    const finalState = await agentRun.output;
    output.todos = parseAgentTodos(finalState.todos) ?? output.todos;
    await saveAssistant(run, output, "completed");

    emit({
      type: "end",
      data: {
        ok: true,
        conversationId: run.conversationId,
        messageId: run.assistantMessageId,
      },
    });
  } catch (error) {
    const aborted = signal.aborted;
    const errorMessage =
      error instanceof Error ? error.message : "Stream failed";
    console.error("Agent stream failed", error);

    try {
      await saveAssistant(
        run,
        output,
        aborted ? "cancelled" : "failed",
        aborted ? undefined : errorMessage,
      );
    } catch (persistenceError) {
      console.error(
        "Failed to persist assistant message state",
        persistenceError,
      );
    }

    if (!aborted) {
      emit({
        type: "error",
        data: { messageId: run.assistantMessageId, error: errorMessage },
      });
    }
  }
}
