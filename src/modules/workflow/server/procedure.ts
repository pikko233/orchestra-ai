import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  getProjectWorkflow,
  saveProjectWorkflow,
  WorkflowNotFoundError,
  WorkflowRevisionConflictError,
} from "@/lib/workflow/persistence";
import { workflowSpecSchema } from "@/lib/workflow/schema";
import { TRPCError } from "@trpc/server";
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
        expectedRevision: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await saveProjectWorkflow({ ...input, userId: ctx.user.id });
      } catch (error) {
        return toTRPCError(error);
      }
    }),
});
