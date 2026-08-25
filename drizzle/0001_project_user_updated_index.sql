DROP INDEX IF EXISTS "project_projectId_updatedAt_idx";
--> statement-breakpoint
CREATE INDEX "project_userId_updatedAt_id_idx" ON "project" USING btree ("user_id","updated_at","id");
