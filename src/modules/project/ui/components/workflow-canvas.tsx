"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type ReactFlowInstance,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "@/components/node/types";
import { NODE_THEMES } from "@/components/node/themes";
import { toReactFlow, type WorkflowFlowNode } from "@/lib/workflow/react-flow";
import type { WorkflowSpec } from "@/lib/workflow/schema";

const miniMapColors: Record<string, string> = {
  agent: NODE_THEMES.agent.accent,
  tool: NODE_THEMES.tool.accent,
  inputNode: NODE_THEMES.input.accent,
  vectorDB: NODE_THEMES.vectorDB.accent,
  embeddingModel: NODE_THEMES.embeddingModel.accent,
  subAgent: NODE_THEMES.subAgent.accent,
  model: NODE_THEMES.model.accent,
};

interface Props {
  workflow: WorkflowSpec | null;
}

export function WorkflowCanvas({ workflow }: Props) {
  const initial = workflow ? toReactFlow(workflow) : { nodes: [], edges: [] };
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>(
    initial.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const instanceRef = useRef<ReactFlowInstance<WorkflowFlowNode> | null>(null);

  useEffect(() => {
    const next = workflow ? toReactFlow(workflow) : { nodes: [], edges: [] };
    setNodes(next.nodes);
    setEdges(next.edges);

    requestAnimationFrame(() => {
      void instanceRef.current?.fitView({ padding: 0.2, maxZoom: 1 });
    });
  }, [setEdges, setNodes, workflow]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: crypto.randomUUID(),
            type: "smoothstep",
          },
          current,
        ),
      );
    },
    [setEdges],
  );

  return (
    <div className="relative h-full min-h-0 w-full bg-slate-50 dark:bg-slate-950">
      <ReactFlow<WorkflowFlowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => {
          instanceRef.current = instance;
        }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="#64748b"
        />
        <Controls className="overflow-hidden! rounded-lg! border-slate-200! shadow-lg! dark:border-slate-800! dark:[&>button]:border-slate-800! dark:[&>button]:bg-slate-900! dark:[&>button]:text-slate-300! dark:[&>button:hover]:bg-slate-800!" />
        <MiniMap
          className="rounded-lg! border! border-slate-200! bg-white/90! shadow-lg! dark:border-slate-800! dark:bg-slate-900/90!"
          nodeColor={(node) => miniMapColors[node.type ?? ""] ?? "#64748b"}
          maskColor="rgba(15, 23, 42, 0.08)"
          pannable
          zoomable
        />
      </ReactFlow>

      {!workflow && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="rounded-lg border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
            在左侧描述你想创建的 Agent 工作流
          </p>
        </div>
      )}
    </div>
  );
}
