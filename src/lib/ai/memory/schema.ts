import { z } from "zod";

export const agentContextSchema = z.object({
  userId: z.string(),
  projectId: z.string(),
  revision: z.number().int().nonnegative(),
});

export type AgentContextType = z.infer<typeof agentContextSchema>;
