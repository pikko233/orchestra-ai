import { createAgent, todoListMiddleware } from "langchain";
import { checkpointer } from "../memory/checkpointer";
import { llm } from "../models/llm";
import { memoryStore } from "../memory/store";
import { agentContextSchema } from "../memory/schema";
import { saveMemoryTool } from "../tools/save-memory-tool";
import { systemPrompt } from "../prompts";
import { memoryMiddleware } from "../middlewares/memory-middleware";
import { replaceWorkflowTool } from "../tools/replace-workflow-tool";
import { generateImageTool } from "../tools/generate-image-tool";
import {
  createScheduleTool,
  listSchedulesTool,
  updateScheduleTool,
} from "../tools/schedule-tools";
import {
  globTool,
  grepTool,
  lsTool,
  readFileTool,
  removeFileTool,
  writeFileTool,
} from "../tools/file-tools";

const todoMiddleware = todoListMiddleware({
  systemPrompt: `
需要调用多个工具、修改多个文件或完成至少三个步骤时，先使用 write_todos 创建任务清单。
清单最多 8 项，第一项立即设为 in_progress；每完成一步立即更新，并将下一项设为 in_progress。
简单问答和一两步即可完成的任务不要创建清单。
`.trim(),
  toolDescription:
    "创建或更新当前复杂任务的完整待办清单，用 pending、in_progress、completed 跟踪进度。",
});

export const streamAgent = createAgent({
  model: llm,
  systemPrompt,
  checkpointer,
  contextSchema: agentContextSchema,
  store: memoryStore,
  middleware: [memoryMiddleware, todoMiddleware],
  tools: [
    saveMemoryTool,
    replaceWorkflowTool,
    readFileTool,
    writeFileTool,
    removeFileTool,
    lsTool,
    globTool,
    grepTool,
    generateImageTool,
    createScheduleTool,
    listSchedulesTool,
    updateScheduleTool,
  ],
});
