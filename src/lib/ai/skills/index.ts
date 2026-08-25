import { readFileSync } from "node:fs";
import type { WorkflowSkillId } from "./catalog";

const workflowSkillFiles: Record<WorkflowSkillId, URL[]> = {
  "frontend-design": [
    new URL("./frontend-design/SKILL.md", import.meta.url),
  ],
  "internal-comms": [
    new URL("./internal-comms/SKILL.md", import.meta.url),
    new URL("./internal-comms/examples/3p-updates.md", import.meta.url),
    new URL("./internal-comms/examples/company-newsletter.md", import.meta.url),
    new URL("./internal-comms/examples/faq-answers.md", import.meta.url),
    new URL("./internal-comms/examples/general-comms.md", import.meta.url),
  ],
  "mcp-builder": [new URL("./mcp-builder/SKILL.md", import.meta.url)],
};

export function loadWorkflowSkills(ids: WorkflowSkillId[]) {
  return ids
    .map((id) => {
      const instructions = workflowSkillFiles[id]
        .map((file) => readFileSync(file, "utf8"))
        .join("\n\n");
      return `<skill name="${id}">\n${instructions}\n</skill>`;
    })
    .join("\n\n");
}
