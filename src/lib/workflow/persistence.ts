import "server-only";

import { db } from "@/db";
import { project } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { workflowSpecSchema, type WorkflowSpec } from "./schema";

export class WorkflowNotFoundError extends Error {}
export class WorkflowRevisionConflictError extends Error {}

export async function getProjectWorkflow(projectId: string, userId: string) {
  const [record] = await db
    .select({ workflow: project.workflow, revision: project.revision })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1);

  if (!record) throw new WorkflowNotFoundError("项目不存在或无权访问");

  return {
    workflow: record.workflow
      ? workflowSpecSchema.parse(record.workflow)
      : null,
    revision: record.revision,
  };
}

export async function saveProjectWorkflow({
  projectId,
  userId,
  workflow,
  expectedRevision,
}: {
  projectId: string;
  userId: string;
  workflow: WorkflowSpec;
  expectedRevision?: number;
}) {
  const parsedWorkflow = workflowSpecSchema.parse(workflow);
  const conditions = [eq(project.id, projectId), eq(project.userId, userId)];

  if (expectedRevision !== undefined) {
    conditions.push(eq(project.revision, expectedRevision));
  }

  const [updated] = await db
    .update(project)
    .set({
      workflow: parsedWorkflow,
      revision: sql`${project.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning({ workflow: project.workflow, revision: project.revision });

  if (updated) {
    return {
      workflow: workflowSpecSchema.parse(updated.workflow),
      revision: updated.revision,
    };
  }

  const existing = await getProjectWorkflow(projectId, userId);
  throw new WorkflowRevisionConflictError(
    `工作流已更新，请基于 revision ${existing.revision} 重试`,
  );
}
