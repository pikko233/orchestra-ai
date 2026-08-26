import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getProjectWorkflow,
  WorkflowNotFoundError,
} from "@/lib/workflow/persistence";
import { runWorkflow } from "@/lib/workflow/runtime/runner";
import { workflowRequiresWriteConfirmation } from "@/lib/workflow/schema";

export const maxDuration = 180;

const requestSchema = z.object({
  projectId: z.string().trim().min(1),
  message: z.string().trim().min(1).max(20_000),
  writeConfirmed: z.boolean().optional().default(false),
});

const encoder = new TextEncoder();
const sse = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "用户未登录" }, { status: 401 });
  }

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "请求参数格式错误", issues: body.error.issues },
      { status: 400 },
    );
  }

  try {
    const { projectId, message, writeConfirmed } = body.data;
    const { workflow, revision } = await getProjectWorkflow(
      projectId,
      session.user.id,
    );
    if (!workflow) {
      return Response.json({ error: "项目尚未创建工作流" }, { status: 409 });
    }
    if (workflowRequiresWriteConfirmation(workflow) && !writeConfirmed) {
      return Response.json(
        { error: "发送邮件或创建日历事件前需要用户确认" },
        { status: 403 },
      );
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(sse("start", { projectId, revision }));

        try {
          for await (const event of runWorkflow({
            workflow,
            message,
            context: { userId: session.user.id, projectId, revision },
            signal: request.signal,
          })) {
            controller.enqueue(sse(event.type, event));
          }
        } catch (error) {
          if (!request.signal.aborted) {
            controller.enqueue(
              sse("error", {
                error: error instanceof Error ? error.message : "工作流执行失败",
              }),
            );
          }
        } finally {
          controller.close();
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
    if (error instanceof WorkflowNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to start workflow", error);
    return Response.json({ error: "工作流启动失败" }, { status: 500 });
  }
}
