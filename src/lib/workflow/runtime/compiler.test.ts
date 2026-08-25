import assert from "node:assert/strict";
import test from "node:test";
import type { WorkflowSpec } from "../schema";
import { compileWorkflow, WorkflowCompileError } from "./compiler";

const nodes: WorkflowSpec["nodes"] = [
  { id: "input", type: "input", data: { label: "Input" } },
  { id: "agent", type: "agent", data: { label: "Agent" } },
  {
    id: "model",
    type: "model",
    data: { label: "Model", modelName: "gpt-5.6-luna" },
  },
];

test("rejects agents without a model", async () => {
  const workflow: WorkflowSpec = {
    version: 1,
    nodes,
    connections: [
      { id: "start", from: "input", to: "agent", kind: "flow" },
    ],
  };

  await assert.rejects(
    compileWorkflow(workflow),
    (error) =>
      error instanceof WorkflowCompileError &&
      error.message.includes("只能连接一个 model"),
  );
});
