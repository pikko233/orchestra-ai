import { tool, type ToolRuntime } from "langchain";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { project, user, workflowSchedule } from "@/db/schema";
import { getNextRunAt } from "@/lib/workflow/schedules";
import type { AgentContextType } from "../memory/schema";

const scheduleFields = {
  name: z.string().trim().min(1).max(120),
  cron: z.string().trim().min(1).max(100),
  timezone: z.string().trim().min(1).max(100),
  input: z.string().trim().min(1).max(20_000),
  recipientEmail: z.email().optional(),
};

export const createScheduleTool = tool(
  async (
    input: z.infer<z.ZodObject<typeof scheduleFields>>,
    runtime: ToolRuntime<unknown, AgentContextType>,
  ) => {
    const { projectId, userId } = runtime.context;
    const [owner] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!owner) throw new Error("用户不存在");
    const [currentProject] = await db
      .select({ workflow: project.workflow })
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.userId, userId)))
      .limit(1);
    if (
      !currentProject?.workflow?.nodes.some(
        (node) =>
          node.type === "tool" && node.data.registryKey === "send_email",
      )
    ) {
      throw new Error("请先为当前工作流连接 send_email 工具");
    }

    const [schedule] = await db
      .insert(workflowSchedule)
      .values({
        ...input,
        userId,
        projectId,
        recipientEmail: input.recipientEmail ?? owner.email,
        enabled: false,
        nextRunAt: getNextRunAt(input.cron, input.timezone),
      })
      .returning();

    return { ...schedule, needsConfirmation: true };
  },
  {
    name: "create_schedule",
    description:
      "创建当前工作流的定时任务。新任务默认停用，必须向用户展示配置并在用户明确确认后再调用 update_schedule 启用。",
    schema: z.object(scheduleFields),
  },
);

export const listSchedulesTool = tool(
  async (_input, runtime: ToolRuntime<unknown, AgentContextType>) => {
    const { projectId, userId } = runtime.context;
    return db
      .select()
      .from(workflowSchedule)
      .where(
        and(
          eq(workflowSchedule.userId, userId),
          eq(workflowSchedule.projectId, projectId),
        ),
      )
      .orderBy(asc(workflowSchedule.nextRunAt));
  },
  {
    name: "list_schedules",
    description: "列出当前项目的定时任务及启用状态。",
    schema: z.object({}),
  },
);

const updateSchema = z
  .object({
    scheduleId: z.string().min(1),
    name: scheduleFields.name.optional(),
    cron: scheduleFields.cron.optional(),
    timezone: scheduleFields.timezone.optional(),
    input: scheduleFields.input.optional(),
    recipientEmail: z.email().optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (values) =>
      Object.entries(values).some(
        ([key, value]) => key !== "scheduleId" && value !== undefined,
      ),
    "至少提供一个需要修改的字段",
  );

export const updateScheduleTool = tool(
  async (
    changes: z.infer<typeof updateSchema>,
    runtime: ToolRuntime<unknown, AgentContextType>,
  ) => {
    const { projectId, userId } = runtime.context;
    const { scheduleId, ...values } = changes;
    const where = and(
      eq(workflowSchedule.id, scheduleId),
      eq(workflowSchedule.userId, userId),
      eq(workflowSchedule.projectId, projectId),
    );
    const [existing] = await db.select().from(workflowSchedule).where(where);
    if (!existing) throw new Error("定时任务不存在");

    const cron = values.cron ?? existing.cron;
    const timezone = values.timezone ?? existing.timezone;
    const [updated] = await db
      .update(workflowSchedule)
      .set({
        ...values,
        nextRunAt: getNextRunAt(cron, timezone),
        lastError: null,
      })
      .where(where)
      .returning();

    return updated;
  },
  {
    name: "update_schedule",
    description:
      "修改、启用或停用当前项目的定时任务。只有用户在看到完整配置后明确确认，才能将 enabled 设置为 true。",
    schema: updateSchema,
  },
);
