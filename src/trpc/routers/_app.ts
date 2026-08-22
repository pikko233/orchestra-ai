import { createTRPCRouter } from "../init";
import { projectProcedure } from "@/modules/project/server/procedure";
import { workflowProcedure } from "@/modules/workflow/server/procedure";
export const appRouter = createTRPCRouter({
  project: projectProcedure,
  workflow: workflowProcedure,
});
// export type definition of API
export type AppRouter = typeof appRouter;
