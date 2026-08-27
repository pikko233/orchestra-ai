import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { db } from "@/db";
import { project } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ALLOWED_IMAGE_TYPES } from "@/lib/ai/images/types";

const upload = createUploadthing();

export const uploadRouter = {
  chatImage: upload(
    { image: { maxFileSize: "4MB", maxFileCount: 3 } },
    { awaitServerData: false },
  )
    .input(z.object({ projectId: z.string().min(1) }))
    .middleware(async ({ req, input, files }) => {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) throw new UploadThingError("UNAUTHORIZED");
      if (
        files.some(
          (file) => !ALLOWED_IMAGE_TYPES.some((type) => type === file.type),
        )
      ) {
        throw new UploadThingError("BAD_REQUEST");
      }

      const [ownedProject] = await db
        .select({ id: project.id })
        .from(project)
        .where(
          and(
            eq(project.id, input.projectId),
            eq(project.userId, session.user.id),
          ),
        )
        .limit(1);
      if (!ownedProject) throw new UploadThingError("NOT_FOUND");

      return { userId: session.user.id };
    })
    .onUploadComplete(() => {}),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
