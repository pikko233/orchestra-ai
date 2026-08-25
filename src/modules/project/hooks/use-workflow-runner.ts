"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readSse } from "@/lib/sse";

export type WorkflowNodeStatus = "idle" | "running" | "success" | "error";

export function useWorkflowRunner(projectId: string) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string>();
  const [nodeStatuses, setNodeStatuses] = useState<
    Record<string, WorkflowNodeStatus>
  >({});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (input: string) => {
      const message = input.trim();
      if (!message || running) return;

      const abortController = new AbortController();
      abortRef.current = abortController;
      setRunning(true);
      setOutput("");
      setError(undefined);
      setNodeStatuses({});

      try {
        const response = await fetch("/api/workflow/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, message }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          const message =
            body &&
            typeof body === "object" &&
            "error" in body &&
            typeof body.error === "string"
              ? body.error
              : `运行失败（${response.status}）`;
          throw new Error(message);
        }

        if (!response.body) throw new Error("浏览器未收到工作流事件流");

        for await (const { event, data } of readSse(response.body)) {
          if (event === "end") break;

          if (
            event === "node" &&
            typeof data.nodeId === "string" &&
            ["running", "success", "error"].includes(String(data.status))
          ) {
            setNodeStatuses((current) => ({
              ...current,
              [data.nodeId as string]: data.status as WorkflowNodeStatus,
            }));
          }

          if (event === "message" && typeof data.delta === "string") {
            setOutput((current) => current + data.delta);
          }

          if (event === "error") {
            setError(
              typeof data.error === "string" ? data.error : "工作流运行失败",
            );
            break;
          }
        }
      } catch (runError) {
        if (!abortController.signal.aborted) {
          setError(
            runError instanceof Error ? runError.message : "工作流运行失败",
          );
        }
      } finally {
        if (abortRef.current === abortController) abortRef.current = null;
        setRunning(false);
      }
    },
    [projectId, running],
  );

  return { run, running, output, error, nodeStatuses };
}
