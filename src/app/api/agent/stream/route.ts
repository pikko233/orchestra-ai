import { headers } from "next/headers";
import { z } from "zod";
import {
  AgentRunNotFoundError,
  prepareAgentRun,
  runPreparedAgent,
} from "@/lib/ai/agents/runner";
import { auth } from "@/lib/auth";

export const maxDuration = 180;

const requestSchema = z.object({
  message: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  conversationId: z.string().trim().min(1).optional(),
  clientMessageId: z.string().trim().min(1).optional(),
});

const encoder = new TextEncoder();
const sse = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return Response.json({ error: "用户未登录" }, { status: 401 });
    }

    const body = requestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!body.success) {
      return Response.json(
        { error: "请求参数格式错误", issues: body.error.issues },
        { status: 400 },
      );
    }

    const run = await prepareAgentRun({
      ...body.data,
      userId: session.user.id,
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          await runPreparedAgent(
            run,
            ({ type, data }) => controller.enqueue(sse(type, data)),
            request.signal,
          );
        } finally {
          try {
            controller.close();
          } catch {}
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
    if (error instanceof AgentRunNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to start agent stream", error);
    return Response.json({ error: "请求失败" }, { status: 500 });
  }
}
