import { tool, type ToolRuntime } from "langchain";
import { saveProjectWorkflow } from "@/lib/workflow/persistence";
import {
  workflowSpecSchema,
  type WorkflowSpec,
} from "@/lib/workflow/schema";
import type { AgentContextType } from "../memory/schema";

export const replaceWorkflowTool = tool(
  async (
    workflow: WorkflowSpec,
    runtime: ToolRuntime<unknown, AgentContextType>,
  ) => {
    const { projectId, revision, userId } = runtime.context;
    const result = await saveProjectWorkflow({
      projectId,
      userId,
      workflow,
      expectedRevision: revision,
    });

    return result.workflow;
  },
  {
    name: "replace_workflow",
    description:
      "使用完整且可渲染的 WorkflowSpec 替换当前项目工作流。创建或修改工作流时调用。",
    schema: workflowSpecSchema,
  },
);
