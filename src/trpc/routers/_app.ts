import { createTRPCRouter } from "../init";
import { projectProcedure } from "@/modules/project/server/procedure";
export const appRouter = createTRPCRouter({
  project: projectProcedure,
});
// export type definition of API
export type AppRouter = typeof appRouter;
