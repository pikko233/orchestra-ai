import { z } from "zod";

export const agentContextSchema = z.object({
  userId: z.string(),
  projectId: z.string(),
});

export type AgentContextType = z.infer<typeof agentContextSchema>;
