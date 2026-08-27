import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db } from "@/db";
import { workflowSchedule } from "@/db/schema";
import {
  getProjectWorkflow,
  saveProjectWorkflow,
  WorkflowNotFoundError,
  WorkflowRevisionConflictError,
} from "@/lib/workflow/persistence";
import { workflowSpecSchema } from "@/lib/workflow/schema";
import { getNextRunAt } from "@/lib/workflow/schedules";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

function toTRPCError(error: unknown): never {
  if (error instanceof WorkflowNotFoundError) {
    throw new TRPCError({ code: "NOT_FOUND", message: error.message });
  }

  if (error instanceof WorkflowRevisionConflictError) {
    throw new TRPCError({ code: "CONFLICT", message: error.message });
  }

  throw error;
}

export const workflowProcedure = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        return await getProjectWorkflow(input.projectId, ctx.user.id);
      } catch (error) {
        return toTRPCError(error);
      }
    }),

  save: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        workflow: workflowSpecSchema,
        expectedRevision: z.number().int().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await saveProjectWorkflow({ ...input, userId: ctx.user.id });
      } catch (error) {
        return toTRPCError(error);
      }
    }),

  schedules: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const schedules = await db
        .select()
        .from(workflowSchedule)
        .where(
          and(
            eq(workflowSchedule.projectId, input.projectId),
            eq(workflowSchedule.userId, ctx.user.id),
          ),
        )
        .orderBy(asc(workflowSchedule.nextRunAt));

      return schedules.map((schedule) => ({
        ...schedule,
        nextRunAt: schedule.nextRunAt.toISOString(),
        lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
      }));
    }),

  setScheduleEnabled: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        scheduleId: z.string().min(1),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const where = and(
        eq(workflowSchedule.id, input.scheduleId),
        eq(workflowSchedule.projectId, input.projectId),
        eq(workflowSchedule.userId, ctx.user.id),
      );
      const [schedule] = await db.select().from(workflowSchedule).where(where);
      if (!schedule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "定时任务不存在" });
      }

      await db
        .update(workflowSchedule)
        .set({
          enabled: input.enabled,
          nextRunAt: input.enabled
            ? getNextRunAt(schedule.cron, schedule.timezone)
            : schedule.nextRunAt,
          lastError: null,
        })
        .where(where);
    }),

  deleteSchedule: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        scheduleId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(workflowSchedule)
        .where(
          and(
            eq(workflowSchedule.id, input.scheduleId),
            eq(workflowSchedule.projectId, input.projectId),
            eq(workflowSchedule.userId, ctx.user.id),
          ),
        )
        .returning({ id: workflowSchedule.id });
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "定时任务不存在" });
      }
    }),
});
