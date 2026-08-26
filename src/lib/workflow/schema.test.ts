import assert from "node:assert/strict";
import test from "node:test";
import { workflowSpecSchema, type WorkflowSpec } from "./schema";

const validWorkflow = {
  version: 1,
  nodes: [
    {
      id: "input",
      type: "input",
      data: { label: "Input" },
    },
    {
      id: "manager",
      type: "agent",
      data: {
        label: "Manager Agent",
        description: "Plans and delegates work",
      },
    },
    {
      id: "search",
      type: "tool",
      data: { label: "Search", registryKey: "search" },
    },
  ],
  connections: [
    { id: "input-manager", from: "input", to: "manager", kind: "flow" },
    { id: "manager-search", from: "manager", to: "search", kind: "tool" },
  ],
} satisfies WorkflowSpec;

test("accepts a valid workflow", () => {
  assert.deepEqual(workflowSpecSchema.parse(validWorkflow), validWorkflow);
});

test("rejects duplicate node ids", () => {
  const result = workflowSpecSchema.safeParse({
    ...validWorkflow,
    nodes: [...validWorkflow.nodes, validWorkflow.nodes[0]],
  });

  assert.equal(result.success, false);
});

test("rejects connections that reference missing nodes", () => {
  const result = workflowSpecSchema.safeParse({
    ...validWorkflow,
    connections: [
      ...validWorkflow.connections,
      { id: "missing", from: "manager", to: "unknown", kind: "flow" },
    ],
  });

  assert.equal(result.success, false);
});

test("requires tool registryKey", () => {
  const result = workflowSpecSchema.safeParse({
    ...validWorkflow,
    nodes: validWorkflow.nodes.map((node) =>
      node.type === "tool"
        ? { id: node.id, type: node.type, data: { label: node.data.label } }
        : node,
    ),
  });

  assert.equal(result.success, false);
});

test("rejects tools outside the registry", () => {
  const result = workflowSpecSchema.safeParse({
    ...validWorkflow,
    nodes: validWorkflow.nodes.map((node) =>
      node.type === "tool"
        ? { ...node, data: { ...node.data, registryKey: "unknown" } }
        : node,
    ),
  });

  assert.equal(result.success, false);
});

test("accepts the dynamic delegation tool", () => {
  const result = workflowSpecSchema.safeParse({
    ...validWorkflow,
    nodes: validWorkflow.nodes.map((node) =>
      node.type === "tool"
        ? { ...node, data: { ...node.data, registryKey: "delegate_tasks" } }
        : node,
    ),
  });

  assert.equal(result.success, true);
});

test("accepts Google Workspace tools", () => {
  for (const registryKey of ["send_email", "google_calendar"]) {
    const result = workflowSpecSchema.safeParse({
      ...validWorkflow,
      nodes: validWorkflow.nodes.map((node) =>
        node.type === "tool"
          ? { ...node, data: { ...node.data, registryKey } }
          : node,
      ),
    });

    assert.equal(result.success, true);
  }
});

test("accepts registered agent skills", () => {
  const result = workflowSpecSchema.safeParse({
    ...validWorkflow,
    nodes: validWorkflow.nodes.map((node) =>
      node.type === "agent"
        ? {
            ...node,
            data: { ...node.data, skills: ["frontend-design"] },
          }
        : node,
    ),
  });

  assert.equal(result.success, true);
});

test("rejects unknown agent skills", () => {
  const result = workflowSpecSchema.safeParse({
    ...validWorkflow,
    nodes: validWorkflow.nodes.map((node) =>
      node.type === "agent"
        ? { ...node, data: { ...node.data, skills: ["unknown"] } }
        : node,
    ),
  });

  assert.equal(result.success, false);
});

test("rejects self connections", () => {
  const result = workflowSpecSchema.safeParse({
    ...validWorkflow,
    connections: [
      ...validWorkflow.connections,
      { id: "self", from: "manager", to: "manager", kind: "flow" },
    ],
  });

  assert.equal(result.success, false);
});

test("rejects incompatible semantic connection kinds", () => {
  const result = workflowSpecSchema.safeParse({
    ...validWorkflow,
    connections: [
      { id: "invalid-tool", from: "input", to: "search", kind: "tool" },
    ],
  });

  assert.equal(result.success, false);
});

test("rejects resource nodes in the control flow", () => {
  const result = workflowSpecSchema.safeParse({
    ...validWorkflow,
    connections: [
      { id: "invalid-flow", from: "input", to: "search", kind: "flow" },
    ],
  });

  assert.equal(result.success, false);
});

test("rejects unsupported chat model names", () => {
  const result = workflowSpecSchema.safeParse({
    version: 1,
    nodes: [
      validWorkflow.nodes[0],
      {
        id: "model",
        type: "model",
        data: { label: "Model", modelName: "GPT" },
      },
    ],
    connections: [],
  });

  assert.equal(result.success, false);
});

test("accepts registered GPT-4o model names", () => {
  for (const modelName of ["gpt-4o", "gpt-4o-mini"]) {
    const result = workflowSpecSchema.safeParse({
      version: 1,
      nodes: [
        validWorkflow.nodes[0],
        {
          id: `model-${modelName}`,
          type: "model",
          data: { label: "Model", modelName },
        },
      ],
      connections: [],
    });

    assert.equal(result.success, true);
  }
});

test("rejects unsupported credential references", () => {
  const result = workflowSpecSchema.safeParse({
    version: 1,
    nodes: [
      validWorkflow.nodes[0],
      {
        id: "model",
        type: "model",
        data: {
          label: "Model",
          modelName: "gpt-5.6-luna",
          credentialId: "custom-key",
        },
      },
    ],
    connections: [],
  });

  assert.equal(result.success, false);
});
