import { z } from "zod";
import { workflowSkillIds } from "@/lib/ai/skills/catalog";

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "只能包含字母、数字、下划线和连字符");

const optionalTextSchema = z.string().trim().min(1).max(2_000).optional();

export const workflowToolRegistry = [
  "search",
  "save_memory",
  "delegate_tasks",
  "send_email",
  "google_calendar",
] as const;
export const workflowChatModelRegistry = [
  "gpt-5.6-luna",
  "gpt-4o",
  "gpt-4o-mini",
] as const;
export type WorkflowChatModelName =
  (typeof workflowChatModelRegistry)[number];

export const workflowNodeTypeSchema = z.enum([
  "input",
  "agent",
  "subAgent",
  "model",
  "tool",
  "embeddingModel",
  "vectorDB",
]);

export const workflowConnectionKindSchema = z.enum([
  "flow",
  "tool",
  "model",
  "context",
  "embedding",
]);

export const workflowNodeStatusSchema = z.enum([
  "idle",
  "running",
  "success",
  "error",
]);

const baseNodeDataSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    sub: z.string().trim().min(1).max(240).optional(),
    description: optionalTextSchema,
  })
  .strict();

export const inputNodeDataSchema = baseNodeDataSchema;

export const agentNodeDataSchema = baseNodeDataSchema
  .extend({
    instructions: optionalTextSchema,
    skills: z.array(z.enum(workflowSkillIds)).max(2).optional(),
  })
  .strict();

export const subAgentNodeDataSchema = agentNodeDataSchema;

const modelConfigShape = {
  provider: z.string().trim().min(1).max(80).optional(),
  endpoint: z.url().optional(),
};

export const modelNodeDataSchema = baseNodeDataSchema
  .extend({
    ...modelConfigShape,
    modelName: z.enum(workflowChatModelRegistry),
  })
  .strict();

export const toolNodeDataSchema = baseNodeDataSchema
  .extend({
    registryKey: z.enum(workflowToolRegistry),
    provider: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const embeddingModelNodeDataSchema = baseNodeDataSchema
  .extend({
    ...modelConfigShape,
    modelName: z.string().trim().min(1).max(160),
    dimensions: z.number().int().positive().optional(),
  })
  .strict();

export const vectorDBNodeDataSchema = baseNodeDataSchema
  .extend({
    provider: z.string().trim().min(1).max(80).optional(),
    endpoint: z.url().optional(),
    collection: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

const workflowNodeSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: identifierSchema,
      type: z.literal("input"),
      data: inputNodeDataSchema,
    })
    .strict(),
  z
    .object({
      id: identifierSchema,
      type: z.literal("agent"),
      data: agentNodeDataSchema,
    })
    .strict(),
  z
    .object({
      id: identifierSchema,
      type: z.literal("subAgent"),
      data: subAgentNodeDataSchema,
    })
    .strict(),
  z
    .object({
      id: identifierSchema,
      type: z.literal("model"),
      data: modelNodeDataSchema,
    })
    .strict(),
  z
    .object({
      id: identifierSchema,
      type: z.literal("tool"),
      data: toolNodeDataSchema,
    })
    .strict(),
  z
    .object({
      id: identifierSchema,
      type: z.literal("embeddingModel"),
      data: embeddingModelNodeDataSchema,
    })
    .strict(),
  z
    .object({
      id: identifierSchema,
      type: z.literal("vectorDB"),
      data: vectorDBNodeDataSchema,
    })
    .strict(),
]);

const workflowConnectionSchema = z
  .object({
    id: identifierSchema,
    from: identifierSchema,
    to: identifierSchema,
    kind: workflowConnectionKindSchema,
  })
  .strict();

export const workflowSpecSchema = z
  .object({
    version: z.literal(1),
    nodes: z.array(workflowNodeSchema).min(1).max(50),
    connections: z.array(workflowConnectionSchema).max(100),
  })
  .strict()
  .superRefine((workflow, context) => {
    const nodeIds = new Set<string>();
    const nodeTypesById = new Map<string, WorkflowNodeType>();

    for (const [index, node] of workflow.nodes.entries()) {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: "custom",
          message: `节点 ID 重复：${node.id}`,
          path: ["nodes", index, "id"],
        });
      }

      nodeIds.add(node.id);
      nodeTypesById.set(node.id, node.type);
    }

    if (!workflow.nodes.some((node) => node.type === "input")) {
      context.addIssue({
        code: "custom",
        message: "工作流至少需要一个 input 节点",
        path: ["nodes"],
      });
    }

    const connectionIds = new Set<string>();

    for (const [index, connection] of workflow.connections.entries()) {
      if (connectionIds.has(connection.id)) {
        context.addIssue({
          code: "custom",
          message: `连接 ID 重复：${connection.id}`,
          path: ["connections", index, "id"],
        });
      }

      connectionIds.add(connection.id);

      if (!nodeIds.has(connection.from)) {
        context.addIssue({
          code: "custom",
          message: `起始节点不存在：${connection.from}`,
          path: ["connections", index, "from"],
        });
      }

      if (!nodeIds.has(connection.to)) {
        context.addIssue({
          code: "custom",
          message: `目标节点不存在：${connection.to}`,
          path: ["connections", index, "to"],
        });
      }

      if (connection.from === connection.to) {
        context.addIssue({
          code: "custom",
          message: "节点不能连接到自身",
          path: ["connections", index],
        });
      }

      const fromType = nodeTypesById.get(connection.from);
      const toType = nodeTypesById.get(connection.to);
      const validKinds: Partial<
        Record<WorkflowConnectionKind, [WorkflowNodeType[], WorkflowNodeType[]]>
      > = {
        flow: [["input", "agent", "subAgent"], ["agent", "subAgent"]],
        tool: [["agent", "subAgent"], ["tool"]],
        model: [["agent", "subAgent"], ["model"]],
        context: [["vectorDB"], ["agent", "subAgent", "model"]],
        embedding: [["embeddingModel"], ["vectorDB"]],
      };
      const kindRule = validKinds[connection.kind];

      if (
        kindRule &&
        fromType &&
        toType &&
        (!kindRule[0].includes(fromType) || !kindRule[1].includes(toType))
      ) {
        context.addIssue({
          code: "custom",
          message: `连接类型 ${connection.kind} 不支持 ${fromType} → ${toType}`,
          path: ["connections", index, "kind"],
        });
      }
    }
  });

export const orchestraNodeDataSchema = baseNodeDataSchema
  .extend({
    instructions: optionalTextSchema,
    skills: z.array(z.enum(workflowSkillIds)).max(2).optional(),
    registryKey: z.enum(workflowToolRegistry).optional(),
    provider: z.string().trim().min(1).max(80).optional(),
    modelName: z.string().trim().min(1).max(160).optional(),
    endpoint: z.url().optional(),
    collection: z.string().trim().min(1).max(160).optional(),
    dimensions: z.number().int().positive().optional(),
    running: z.boolean().optional(),
    status: workflowNodeStatusSchema.optional(),
  })
  .strict();

export type WorkflowNodeType = z.infer<typeof workflowNodeTypeSchema>;
export type WorkflowConnectionKind = z.infer<
  typeof workflowConnectionKindSchema
>;
export type WorkflowSpec = z.infer<typeof workflowSpecSchema>;
export type WorkflowNode = WorkflowSpec["nodes"][number];
export type WorkflowConnection = WorkflowSpec["connections"][number];
export type OrchestraNodeData = z.infer<typeof orchestraNodeDataSchema> &
  Record<string, unknown>;
