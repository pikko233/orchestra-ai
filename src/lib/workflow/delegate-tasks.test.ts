import assert from "node:assert/strict";
import test from "node:test";
import { FakeToolCallingModel } from "langchain";
import { createDelegateTasksTool } from "@/lib/ai/tools/delegate-tasks-tool";

const task = (id: string, modelName?: "gpt-4o") => ({
  id,
  role: `Role ${id}`,
  task: `Investigate ${id}`,
  expectedOutput: `Report ${id}`,
  modelName,
});

test("runs delegated tasks and returns results in task order", async () => {
  const selectedModels: string[] = [];
  const delegateTasks = createDelegateTasksTool({
    createModel: (modelName) => {
      selectedModels.push(modelName);
      return new FakeToolCallingModel();
    },
    defaultModelName: "gpt-5.6-luna",
    parentNodeId: "manager",
  });

  const output = await delegateTasks.invoke({
    tasks: [task("one"), task("two", "gpt-4o")],
  });

  assert.deepEqual(
    output.results.map((result) => ({ id: result.id, status: result.status })),
    [
      { id: "one", status: "success" },
      { id: "two", status: "success" },
    ],
  );
  assert.deepEqual(selectedModels, ["gpt-5.6-luna", "gpt-4o"]);
  assert.deepEqual(
    output.results.map((result) => result.modelName),
    ["gpt-5.6-luna", "gpt-4o"],
  );
});

test("limits one delegation call to six tasks", async () => {
  const delegateTasks = createDelegateTasksTool({
    createModel: () => new FakeToolCallingModel(),
    defaultModelName: "gpt-5.6-luna",
    parentNodeId: "manager",
  });

  await assert.rejects(
    delegateTasks.invoke({
      tasks: Array.from({ length: 7 }, (_, index) => task(`task-${index}`)),
    }),
  );
});
