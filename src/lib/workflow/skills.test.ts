import assert from "node:assert/strict";
import test from "node:test";
import { workflowSkillIds } from "@/lib/ai/skills/catalog";
import { loadWorkflowSkills } from "@/lib/ai/skills";

test("loads instructions for every registered workflow skill", () => {
  for (const id of workflowSkillIds) {
    const instructions = loadWorkflowSkills([id]);

    assert.match(instructions, new RegExp(`<skill name="${id}">`));
    assert.ok(instructions.length > 100);
  }
});
