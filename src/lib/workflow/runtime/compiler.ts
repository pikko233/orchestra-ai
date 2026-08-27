import type { BaseStore } from "@langchain/langgraph";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { agentContextSchema } from "@/lib/ai/memory/schema";
import {
  createAgentExecutor,
  type AgentNode,
  type ModelNode,
  type ToolNode,
} from "./executor";
import type { WorkflowNode, WorkflowSpec } from "../schema";

export class WorkflowCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowCompileError";
  }
}

const isAgent = (node: WorkflowNode): node is AgentNode =>
  node.type === "agent" || node.type === "subAgent";

export function getWorkflowOutputNodeIds(workflow: WorkflowSpec) {
  const agents = workflow.nodes.filter(isAgent);
  const agentIds = new Set(agents.map(({ id }) => id));
  const nodesWithSuccessors = new Set(
    workflow.connections
      .filter(({ from, kind }) => kind === "flow" && agentIds.has(from))
      .map(({ from }) => from),
  );

  return new Set(
    agents
      .filter(({ id }) => !nodesWithSuccessors.has(id))
      .map(({ id }) => id),
  );
}

export async function compileWorkflow(
  workflow: WorkflowSpec,
  options: { store?: BaseStore; recipientEmail?: string } = {},
) {
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  const agents = workflow.nodes.filter(isAgent);
  const agentIds = new Set(agents.map(({ id }) => id));
  const flow = workflow.connections.filter(({ kind }) => kind === "flow");

  const starts = flow
    .filter(({ from }) => nodes.get(from)?.type === "input")
    .map(({ to }) => to);
  const transitions = flow.filter(({ from }) => agentIds.has(from));
  if (starts.length === 0) {
    throw new WorkflowCompileError("input 必须通过 flow 连接到 agent");
  }

  assertAcyclicAndReachable(agents, starts, transitions);

  const actions = Object.fromEntries(
    agents.map((agent) => {
      const modelNodes = workflow.connections
        .filter(({ from, kind }) => from === agent.id && kind === "model")
        .map(({ to }) => nodes.get(to) as ModelNode);
      if (modelNodes.length !== 1) {
        throw new WorkflowCompileError(
          `agent 必须且只能连接一个 model：${agent.id}`,
        );
      }

      const toolNodes = workflow.connections
        .filter(({ from, kind }) => from === agent.id && kind === "tool")
        .map(({ to }) => nodes.get(to) as ToolNode);

      return [
        agent.id,
        createAgentExecutor(
          agent,
          modelNodes[0],
          toolNodes,
          options.recipientEmail,
        ),
      ] as const;
    }),
  );

  const graph = new StateGraph(MessagesAnnotation, agentContextSchema).addNode(
    actions,
  );
  const startSet = new Set(starts);
  for (const id of startSet) graph.addEdge(START, id);

  const parentsByTarget = Map.groupBy(transitions, ({ to }) => to);
  for (const [target, connections] of parentsByTarget) {
    if (startSet.has(target)) {
      throw new WorkflowCompileError(
        `agent 不能同时由 input 和其他 agent 触发：${target}`,
      );
    }
    const parents = connections.map(({ from }) => from);
    graph.addEdge(parents.length === 1 ? parents[0] : parents, target);
  }

  for (const { id } of agents) {
    if (!transitions.some(({ from }) => from === id)) graph.addEdge(id, END);
  }

  return graph.compile({ name: "workflow", store: options.store });
}

function assertAcyclicAndReachable(
  agents: AgentNode[],
  starts: string[],
  transitions: Array<{ from: string; to: string }>,
) {
  const next = new Map<string, string[]>();
  for (const { from, to } of transitions) {
    next.set(from, [...(next.get(from) ?? []), to]);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      throw new WorkflowCompileError(`控制流不能包含循环：${id}`);
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of next.get(id) ?? []) visit(child);
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of starts) visit(id);
  const unreachable = agents.find(({ id }) => !visited.has(id));
  if (unreachable) {
    throw new WorkflowCompileError(`agent 无法从 input 到达：${unreachable.id}`);
  }
}
