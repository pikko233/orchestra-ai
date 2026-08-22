ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "workflow" jsonb;
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "revision" integer DEFAULT 0 NOT NULL;
