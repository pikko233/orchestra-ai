import assert from "node:assert/strict";
import test from "node:test";
import type { WorkflowSpec } from "../schema";
import {
  compileWorkflow,
  getWorkflowOutputNodeIds,
  WorkflowCompileError,
} from "./compiler";

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

test("uses only terminal agents as workflow output nodes", () => {
  const workflow: WorkflowSpec = {
    version: 1,
    nodes: [
      nodes[0],
      { id: "coordinator", type: "agent", data: { label: "Coordinator" } },
      { id: "pros", type: "subAgent", data: { label: "Pros" } },
      { id: "cons", type: "subAgent", data: { label: "Cons" } },
      { id: "summary", type: "agent", data: { label: "Summary" } },
    ],
    connections: [
      { id: "start", from: "input", to: "coordinator", kind: "flow" },
      { id: "to-pros", from: "coordinator", to: "pros", kind: "flow" },
      { id: "to-cons", from: "coordinator", to: "cons", kind: "flow" },
      { id: "pros-summary", from: "pros", to: "summary", kind: "flow" },
      { id: "cons-summary", from: "cons", to: "summary", kind: "flow" },
    ],
  };

  assert.deepEqual([...getWorkflowOutputNodeIds(workflow)], ["summary"]);
});
