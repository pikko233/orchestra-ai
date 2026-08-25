export const workflowSkillCatalog = {
  "frontend-design": "前端界面、交互、视觉风格与用户体验设计",
  "internal-comms": "状态报告、项目更新、FAQ、内部公告等企业沟通写作",
  "mcp-builder": "MCP Server、外部 API 集成与工具接口设计",
} as const;

export const workflowSkillIds = Object.keys(
  workflowSkillCatalog,
) as [WorkflowSkillId, ...WorkflowSkillId[]];

export type WorkflowSkillId = keyof typeof workflowSkillCatalog;

export const workflowSkillSummary = workflowSkillIds
  .map((id) => `- ${id}：${workflowSkillCatalog[id]}`)
  .join("\n");
