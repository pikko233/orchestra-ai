import assert from "node:assert/strict";
import test from "node:test";
import type { WorkflowSpec } from "./schema";
import { layoutWorkflow, toReactFlow } from "./react-flow";

const workflow = {
  version: 1,
  nodes: [
    { id: "input", type: "input", data: { label: "Input" } },
    { id: "agent", type: "agent", data: { label: "Agent" } },
    {
      id: "tool",
      type: "tool",
      data: { label: "Search", registryKey: "search" },
    },
  ],
  connections: [
    { id: "input-agent", from: "input", to: "agent", kind: "flow" },
    { id: "agent-tool", from: "agent", to: "tool", kind: "tool" },
  ],
} satisfies WorkflowSpec;

test("lays dependencies rightward and tools below their agent", () => {
  const positions = layoutWorkflow(workflow);

  assert.ok(positions.input.x < positions.agent.x);
  assert.equal(positions.agent.x - positions.input.x, 232);
  assert.equal(positions.agent.x, positions.tool.x);
  assert.ok(positions.agent.y < positions.tool.y);
});

test("maps node types and semantic handles", () => {
  const result = toReactFlow(workflow);

  assert.equal(result.nodes[0].type, "inputNode");
  assert.equal(result.edges[0].type, "bezier");
  assert.deepEqual(
    {
      sourceHandle: result.edges[1].sourceHandle,
      targetHandle: result.edges[1].targetHandle,
    },
    { sourceHandle: "tools", targetHandle: "in" },
  );
});

test("uses the rendered width when spacing regular nodes", () => {
  const regularWorkflow = {
    version: 1,
    nodes: [
      { id: "first", type: "agent", data: { label: "First" } },
      { id: "second", type: "agent", data: { label: "Second" } },
    ],
    connections: [
      { id: "first-second", from: "first", to: "second", kind: "flow" },
    ],
  } satisfies WorkflowSpec;
  const positions = layoutWorkflow(regularWorkflow);

  assert.equal(positions.second.x - positions.first.x, 344);
});
