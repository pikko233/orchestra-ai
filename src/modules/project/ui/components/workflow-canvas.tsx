"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type ReactFlowInstance,
  type XYPosition,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "@/components/node/types";
import { NODE_THEMES } from "@/components/node/themes";
import { toast } from "@/components/ui/toast";
import { toReactFlow, type WorkflowFlowNode } from "@/lib/workflow/react-flow";
import type {
  WorkflowConnectionKind,
  WorkflowNodeType,
  WorkflowSpec,
} from "@/lib/workflow/schema";
import type { WorkflowNodeStatus } from "@/modules/project/hooks/use-workflow-runner";

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
  nodeStatuses: Record<string, WorkflowNodeStatus>;
  onWorkflowChange: (workflow: WorkflowSpec) => void;
  canvasRef: Ref<WorkflowCanvasHandle>;
}

export type WorkflowCanvasHandle = {
  getRandomCenterPosition: () => XYPosition;
  getNodePositions: () => Record<string, XYPosition>;
};

function getConnectionKind(
  source: WorkflowNodeType,
  target: WorkflowNodeType,
  sourceHandle: string | null,
): WorkflowConnectionKind | null {
  const isAgent = source === "agent" || source === "subAgent";
  if (isAgent && sourceHandle === "tools" && target === "tool") return "tool";
  if (isAgent && sourceHandle === "out" && target === "model") return "model";
  if (
    sourceHandle === "out" &&
    (source === "input" || isAgent) &&
    (target === "agent" || target === "subAgent")
  ) {
    return "flow";
  }
  return null;
}

export function WorkflowCanvas({
  workflow,
  nodeStatuses,
  onWorkflowChange,
  canvasRef,
}: Props) {
  const initial = workflow ? toReactFlow(workflow) : { nodes: [], edges: [] };
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>(
    initial.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ReactFlowInstance<WorkflowFlowNode> | null>(null);
  const workflowRef = useRef(workflow);

  useImperativeHandle(canvasRef, () => ({
    getNodePositions: () =>
      Object.fromEntries(
        (instanceRef.current?.getNodes() ?? []).map(({ id, position }) => [
          id,
          { ...position },
        ]),
      ),
    getRandomCenterPosition: () => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds || !instanceRef.current) return { x: 0, y: 0 };

      return instanceRef.current.screenToFlowPosition({
        x: bounds.left + bounds.width / 2 + (Math.random() - 0.5) * 360,
        y: bounds.top + bounds.height / 2 + (Math.random() - 0.5) * 240,
      });
    },
  }));

  useEffect(() => {
    const next = workflow ? toReactFlow(workflow) : { nodes: [], edges: [] };
    workflowRef.current = workflow;
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setEdges, setNodes, workflow]);

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        data: { ...node.data, status: nodeStatuses[node.id] ?? "idle" },
      })),
    );
  }, [nodeStatuses, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const current = workflowRef.current;
      if (!current || !connection.source || !connection.target) return;

      const source = current.nodes.find(({ id }) => id === connection.source);
      const target = current.nodes.find(({ id }) => id === connection.target);
      if (!source || !target) return;

      const kind = getConnectionKind(
        source.type,
        target.type,
        connection.sourceHandle,
      );
      if (!kind) return;

      const nextConnection = {
        id: crypto.randomUUID(),
        from: connection.source,
        to: connection.target,
        kind,
      };
      if (
        current.connections.some(
          ({ from, to, kind: currentKind }) =>
            from === nextConnection.from &&
            to === nextConnection.to &&
            currentKind === kind,
        )
      ) {
        return;
      }

      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: nextConnection.id,
            label: kind,
            type: "bezier",
          },
          current,
        ),
      );
      const next = {
        ...current,
        connections: [...current.connections, nextConnection],
      };
      workflowRef.current = next;
      onWorkflowChange(next);
    },
    [onWorkflowChange, setEdges],
  );

  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: WorkflowFlowNode) => {
      const current = workflowRef.current;
      if (!current) return;
      const next = {
        ...current,
        nodes: current.nodes.map((item) =>
          item.id === node.id ? { ...item, position: node.position } : item,
        ),
      };
      workflowRef.current = next;
      onWorkflowChange(next);
    },
    [onWorkflowChange],
  );

  const onNodesDelete = useCallback(
    (deleted: WorkflowFlowNode[]) => {
      const current = workflowRef.current;
      if (!current) return;
      const ids = new Set(deleted.map(({ id }) => id));
      const next = {
        ...current,
        nodes: current.nodes.filter(({ id }) => !ids.has(id)),
        connections: current.connections.filter(
          ({ from, to }) => !ids.has(from) && !ids.has(to),
        ),
      };
      workflowRef.current = next;
      onWorkflowChange(next);
    },
    [onWorkflowChange],
  );

  const onBeforeDelete = useCallback(
    async ({ nodes: deleted }: { nodes: WorkflowFlowNode[] }) => {
      const current = workflowRef.current;
      if (!current || deleted.length === 0) return true;
      const ids = new Set(deleted.map(({ id }) => id));
      const remaining = current.nodes.filter(({ id }) => !ids.has(id));
      const removesLastInput =
        current.nodes.some(({ type }) => type === "input") &&
        !remaining.some(({ type }) => type === "input");
      if (remaining.length > 0 && !removesLastInput) {
        return true;
      }
      toast.add({
        type: "warning",
        title: "工作流必须保留至少一个用户输入节点",
      });
      return false;
    },
    [],
  );

  const onEdgesDelete = useCallback(
    (deleted: Array<{ id: string }>) => {
      const current = workflowRef.current;
      if (!current) return;
      const ids = new Set(deleted.map(({ id }) => id));
      const next = {
        ...current,
        connections: current.connections.filter(({ id }) => !ids.has(id)),
      };
      workflowRef.current = next;
      onWorkflowChange(next);
    },
    [onWorkflowChange],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 w-full bg-slate-50 dark:bg-slate-950"
    >
      <ReactFlow<WorkflowFlowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onBeforeDelete={onBeforeDelete}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        connectionLineType={ConnectionLineType.Bezier}
        onInit={(instance) => {
          instanceRef.current = instance;
        }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "bezier",
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
