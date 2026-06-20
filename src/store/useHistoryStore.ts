/**
 * History store: runs + per-node executions for the current workflow.
 * Hydrates from server and polls /api/runs/[id] while a run is in flight.
 */
"use client";

import { create } from "zustand";
import { useExecutionStore } from "./useExecutionStore";
import { useWorkflowStore } from "./useWorkflowStore";

export interface NodeExecution {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: "pending" | "running" | "success" | "failed";
  inputsJson: string | null;
  outputJson: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export interface Run {
  id: string;
  workflowId: string;
  status: "running" | "success" | "failed" | "partial";
  scope: string;
  startedAt: string;
  finishedAt: string | null;
  triggerRunId: string | null;
  executions: NodeExecution[];
}

interface HistoryState {
  runs: Run[];
  loading: boolean;
  error: string | null;
  activeRunId: string | null;
  setRuns(runs: Run[]): void;
  setActiveRun(id: string | null): void;
  upsertRun(run: Run): void;
  fetchRuns(workflowId: string): Promise<void>;
  pollActiveRun(): () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  runs: [],
  loading: false,
  error: null,
  activeRunId: null,

  setRuns(runs) {
    set({ runs });
  },
  setActiveRun(id) {
    set({ activeRunId: id });
  },
  upsertRun(run) {
    const existing = get().runs.findIndex((r) => r.id === run.id);
    if (existing === -1) {
      set({ runs: [run, ...get().runs] });
    } else {
      const next = get().runs.slice();
      next[existing] = run;
      set({ runs: next });
    }
  },

  async fetchRuns(workflowId) {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/runs?workflowId=${encodeURIComponent(workflowId)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runs: Run[] };
      const active = get().activeRunId
        ? data.runs.find((run) => run.id === get().activeRunId)
        : data.runs.find((run) => run.status === "running");
      if (active) syncRunToStores(active);
      set({ runs: data.runs, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  pollActiveRun() {
    const { activeRunId } = get();
    if (!activeRunId) return () => {};
    const id = activeRunId;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/runs/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { run: Run };
          syncRunToStores(data.run);
          get().upsertRun(data.run);
          if (data.run.status !== "running") {
            set({ activeRunId: null });
            return;
          }
        }
      } catch {
        // ignore transient errors
      }
      if (!stopped) setTimeout(tick, 1500);
    };
    setTimeout(tick, 1000);
    return () => {
      stopped = true;
    };
  },
}));

function syncRunToStores(run: Run) {
  const execution = useExecutionStore.getState();
  const workflow = useWorkflowStore.getState();

  for (const exec of run.executions) {
    if (exec.status === "running") {
      execution.startNode(exec.nodeId);
      continue;
    }

    if (exec.status === "success") {
      const output = parseJson(exec.outputJson);
      execution.finishNode(exec.nodeId, output);
      const patch = patchFromExecution(exec, output);
      if (patch && hasChanged(exec.nodeId, patch)) {
        workflow.updateNodeData(exec.nodeId, patch);
      }
      continue;
    }

    if (exec.status === "failed") {
      execution.failNode(exec.nodeId, exec.error ?? "Node failed");
    }
  }
}

function parseJson(text: string | null) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function patchFromExecution(
  exec: NodeExecution,
  output: unknown,
): Record<string, unknown> | null {
  if (!output || typeof output !== "object") return null;
  const data = output as Record<string, unknown>;
  if (exec.nodeType === "gemini" && typeof data.outputText === "string") {
    return { result: data.outputText };
  }
  if (exec.nodeType === "cropImage" && typeof data.outputImage === "string") {
    return { outputImage: data.outputImage };
  }
  if (exec.nodeType === "response" && typeof data.captured === "string") {
    return { captured: data.captured };
  }
  return null;
}

function hasChanged(nodeId: string, patch: Record<string, unknown>) {
  const node = useWorkflowStore.getState().nodes.find((item) => item.id === nodeId);
  if (!node) return false;
  const data = node.data as Record<string, unknown>;
  return Object.entries(patch).some(([key, value]) => data[key] !== value);
}
