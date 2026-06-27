"use client";
import { useRouter } from "next/navigation";
import { useState, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Play,
  Square,
  Clock,
  Save,
  Check,
  Undo2,
  Redo2,
  LogOut,
} from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { useExecutionStore } from "@/store/useExecutionStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { cn } from "@/lib/cn";

interface Props {
  workflowId: string;
  onToggleHistory: () => void;
  historyOpen: boolean;
}

export function Header({ workflowId, onToggleHistory, historyOpen }: Props) {
  const router = useRouter();
  const { signOut } = useClerk();
  const name = useWorkflowStore((s) => s.name);
  const setName = useWorkflowStore((s) => s.setName);
  const nodes = useWorkflowStore((s) => s.nodes);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const pastLen = useWorkflowStore((s) => s.past.length);
  const futureLen = useWorkflowStore((s) => s.future.length);
  const selectedNodeIds = useWorkflowStore((s) => s.selectedNodeIds);
  const reset = useExecutionStore((s) => s.reset);
  const setActiveRun = useHistoryStore((s) => s.setActiveRun);
  const pollActiveRun = useHistoryStore((s) => s.pollActiveRun);
  const activeRunId = useHistoryStore((s) => s.activeRunId);
  const fetchRuns = useHistoryStore((s) => s.fetchRuns);

  const [starting, setStarting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRunning = activeRunId !== null;

  const runScope = (): { type: "full" | "partial" | "single"; nodeIds?: string[]; nodeId?: string } => {
    if (selectedNodeIds.length === 1) {
      return { type: "single", nodeId: selectedNodeIds[0] };
    }
    if (selectedNodeIds.length > 1) {
      return { type: "partial", nodeIds: selectedNodeIds };
    }
    return { type: "full" };
  };

  const onRun = async () => {
    setError(null);
    setStarting(true);
    reset();

    // Auto-save the current canvas state before running
    const { name: currentName, nodes: currentNodes, edges: currentEdges } = useWorkflowStore.getState();
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentName,
          nodesJson: JSON.stringify(currentNodes),
          edgesJson: JSON.stringify(currentEdges),
        }),
      });

      const scope = runScope();
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, scope }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const { runId } = await res.json();
      setActiveRun(runId);
      pollActiveRun();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const onStop = async () => {
    if (!activeRunId) return;
    setError(null);
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(activeRunId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setActiveRun(null);
      void fetchRuns(workflowId);
      setError("Success: Workflow stopped.");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /** Persists the current canvas state. Shows a "Saved ✓" indicator for 1.5s. */
  const onSave = useCallback(async () => {
    setSaveState("saving");
    const { name, nodes, edges } = useWorkflowStore.getState();
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          nodesJson: JSON.stringify(nodes),
          edgesJson: JSON.stringify(edges),
        }),
      });
      setSaveState("saved");
    } catch {
      setSaveState("idle");
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveState("idle"), 1500);
  }, [workflowId]);

  /** Debounced auto-save triggered when the name input changes. */
  const onNameChange = (value: string) => {
    setName(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void onSave();
    }, 600);
  };

  const navigateBack = () => {
    // Fire the save in the background — don't await it so navigation is instant.
    const { name: currentName, nodes: currentNodes, edges: currentEdges } =
      useWorkflowStore.getState();
    fetch(`/api/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: currentName,
        nodesJson: JSON.stringify(currentNodes),
        edgesJson: JSON.stringify(currentEdges),
      }),
      keepalive: true, // completes even after page unmounts
    }).catch(() => {});
    router.push("/dashboard");
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none font-sans">
      {/* Left section — back + name */}
      <div className="nf-glass rounded-full px-3 py-2 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={navigateBack}
          className="size-8 rounded-full hover:bg-gray-100 grid place-items-center text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
          title="Back to Dashboard"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <button
          onClick={navigateBack}
          className="flex items-center gap-1.5 hover:opacity-85 transition-opacity cursor-pointer px-1"
          title="Go to Dashboard (saves progress)"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/ChatGPT Image Jun 19, 2026, 04_29_44 PM (1).png" 
            alt="NextFlow Icon" 
            className="size-5 rounded object-contain"
          />
          <span className="text-xs font-extrabold text-gray-900 tracking-tight font-display">NextFlow</span>
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onBlur={() => void onSave()}
          className="bg-transparent text-sm font-semibold text-gray-900 focus:outline-none min-w-[100px] max-w-[200px] px-1"
          placeholder="Untitled workflow"
        />
        <button
          onClick={() => void onSave()}
          disabled={saveState === "saving"}
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-1 transition-all duration-200 cursor-pointer text-xs font-semibold",
            saveState === "saved"
              ? "text-green-600 bg-green-50"
              : saveState === "saving"
                ? "text-gray-400 cursor-wait"
                : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          )}
          title="Save workflow"
        >
          {saveState === "saved" ? (
            <><Check className="size-3.5" /><span>Saved</span></>
          ) : (
            <Save className="size-3.5" />
          )}
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <button
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="size-8 rounded-full hover:bg-red-50 grid place-items-center text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
          title="Sign out"
        >
          <LogOut className="size-3.5" />
        </button>
      </div>

      {/* Right section — undo/redo + run + history */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Undo / Redo */}
        <div className="nf-glass rounded-full px-2 py-1.5 flex items-center gap-1">
          <button
            disabled={pastLen === 0}
            onClick={undo}
            className="size-8 rounded-full grid place-items-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Undo"
          >
            <Undo2 className="size-3.5" />
          </button>
          <button
            disabled={futureLen === 0}
            onClick={redo}
            className="size-8 rounded-full grid place-items-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Redo"
          >
            <Redo2 className="size-3.5" />
          </button>
        </div>

        {/* Node count badge */}
        <div className="nf-glass rounded-full px-3 py-2 text-xs text-gray-500 font-semibold">
          {nodes.length} node{nodes.length !== 1 ? "s" : ""}
        </div>

        {/* Run / Stop button */}
        <button
          onClick={isRunning ? onStop : onRun}
          disabled={starting}
          className={cn(
            "size-10 rounded-full grid place-items-center text-white shadow-lg transition-all cursor-pointer",
            starting
              ? "bg-gray-400 cursor-not-allowed shadow-none"
              : isRunning
                ? "bg-rose-600 hover:bg-rose-500 shadow-rose-200 hover:shadow-rose-300 hover:scale-105 animate-pulse"
                : "bg-violet-600 hover:bg-violet-500 shadow-violet-200 hover:shadow-violet-300 hover:scale-105"
          )}
          title={isRunning ? "Stop running workflow" : "Run workflow"}
        >
          {isRunning ? (
            <Square className="size-3.5 fill-white text-white" />
          ) : (
            <Play className="size-4 ml-0.5 fill-white text-white" />
          )}
        </button>

        {/* History toggle */}
        <button
          onClick={onToggleHistory}
          className={cn(
            "nf-glass size-10 rounded-full grid place-items-center transition-colors cursor-pointer",
            historyOpen
              ? "text-violet-600 bg-violet-50"
              : "text-gray-500 hover:text-gray-900"
          )}
          title="Toggle run history"
        >
          <Clock className="size-4" />
        </button>
      </div>

      {/* Error toast */}
      {error && (
        <div 
          className={cn(
            "absolute top-16 right-4 nf-glass rounded-xl px-4 py-2.5 text-xs border pointer-events-auto max-w-sm shadow-lg animate-in slide-in-from-top-2 duration-200",
            error.startsWith("Success") 
              ? "text-emerald-700 border-emerald-200 bg-emerald-50/90" 
              : "text-red-700 border-red-200 bg-red-50/90"
          )}
        >
          <span className="font-semibold">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-3 text-red-400 hover:text-red-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
