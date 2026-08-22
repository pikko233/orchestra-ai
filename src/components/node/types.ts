import type { NodeTypes } from "@xyflow/react";
import { AgentNode } from "./agent-node";
import { EmbeddingModelNode } from "./embedding-model-node";
import { InputNode } from "./input-node";
import { ModelNode } from "./model-node";
import { SubAgentNode } from "./sub-agent-node";
import { ToolNode } from "./tool-node";
import { VectorDBNode } from "./vector-db-node";

export const nodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  inputNode: InputNode,
  vectorDB: VectorDBNode,
  embeddingModel: EmbeddingModelNode,
  subAgent: SubAgentNode,
  model: ModelNode,
} satisfies NodeTypes;
