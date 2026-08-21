import { createAgent } from "langchain";
import { checkpointer } from "../memory/checkpointer";
import { llm } from "../models/llm";
import { memoryStore } from "../memory/store";
import { agentContextSchema } from "../memory/schema";
import { saveMemoryTool } from "../tools/save-memory-tool";
import { systemPrompt } from "../prompts";
import { memoryMiddleware } from "../middlewares/memory-middleware";

export const mainAgent = createAgent({
  model: llm,
  systemPrompt,
  checkpointer,
  contextSchema: agentContextSchema,
  store: memoryStore,
  middleware: [memoryMiddleware],
  tools: [saveMemoryTool],
});
