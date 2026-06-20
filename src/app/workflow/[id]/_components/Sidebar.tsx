"use client";
import { Play, Square, Undo2, Redo2, Download, Upload, Workflow } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { useExecutionStore } from "@/store/useExecutionStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { cn } from "@/lib/cn";

interface Props {
  workflowId: string;
}

export function Sidebar({ workflowId }: Props) {
  const name = useWorkflowStore((s) => s.name);
  const setName = useWorkflowStore((s) => s.setName);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const past = useWorkflowStore((s) => s.past.length);
  const future = useWorkflowStore((s) => s.future.length);
  const selectedNodeIds = useWorkflowStore((s) => s.selectedNodeIds);
  const exportJson = useWorkflowStore((s) => s.exportJson);
  const importJson = useWorkflowStore((s) => s.importJson);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useExecutionStore((s) => s.reset);
  const setActiveRun = useHistoryStore((s) => s.setActiveRun);
  const pollActiveRun = useHistoryStore((s) => s.pollActiveRun);
  const fetchRuns = useHistoryStore((s) => s.fetchRuns);

  useEffect(() => {
    void fetchRuns(workflowId);
  }, [workflowId, fetchRuns]);

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
    setRunning(true);
    reset();
    try {
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
      setRunning(false);
    }
    // running flag is cleared by the polling store when run finishes
    setTimeout(() => setRunning(false), 1500);
  };

  const onExport = () => {
    const text = exportJson();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\W+/g, "-").toLowerCase() || "workflow"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const ok = importJson(text);
    if (!ok) setError("Import failed — invalid file");
    e.target.value = "";
  };

  return (
    <aside className="w-60 shrink-0 border-r border-zinc-800 bg-zinc-950/80 flex flex-col transition-all duration-500 ease-in-out">
      <div className="px-3 py-3 border-b border-zinc-800 flex items-center gap-2">
        <div className="size-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 grid place-items-center transition-transform hover:scale-105 duration-300">
          <Workflow className="size-3.5 text-white" />
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-transparent text-sm font-semibold flex-1 focus:outline-none focus:bg-zinc-900/50 rounded px-1.5 py-1 text-white transition-colors duration-200"
        />
      </div>

      <div className="p-3 space-y-2">
        <button
          onClick={onRun}
          disabled={running}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 transform",
            "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white",
            "active:scale-[0.98] hover:shadow-lg hover:shadow-violet-500/25",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100",
            running && "animate-pulse-glow"
          )}
        >
          {running ? <Square className="size-4 animate-scale-in" /> : <Play className="size-4" />}
          {selectedNodeIds.length === 0
            ? "Run"
            : selectedNodeIds.length === 1
              ? "Run selected"
              : `Run ${selectedNodeIds.length} selected`}
        </button>

        {error && (
          <div className="text-[11px] text-red-400 rounded-md border border-red-800 bg-red-950/30 px-2 py-1.5 animate-slide-up">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <button
            disabled={past === 0}
            onClick={undo}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80 text-zinc-300 disabled:opacity-40 px-2 py-1.5 text-xs transition-all duration-200 active:scale-95 disabled:active:scale-100"
            title="Undo (⌘Z)"
          >
            <Undo2 className="size-3.5" /> Undo
          </button>
          <button
            disabled={future === 0}
            onClick={redo}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80 text-zinc-300 disabled:opacity-40 px-2 py-1.5 text-xs transition-all duration-200 active:scale-95 disabled:active:scale-100"
            title="Redo (⌘⇧Z)"
          >
            <Redo2 className="size-3.5" /> Redo
          </button>
          <button
            onClick={onExport}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80 text-zinc-300 px-2 py-1.5 text-xs transition-all duration-200 active:scale-95"
          >
            <Download className="size-3.5" /> Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80 text-zinc-300 px-2 py-1.5 text-xs transition-all duration-200 active:scale-95"
          >
            <Upload className="size-3.5" /> Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={onImport}
          />
        </div>
      </div>

      <div className="mt-auto px-3 py-2 text-[10px] text-zinc-600 border-t border-zinc-800">
        Press <kbd className="px-1 rounded bg-zinc-900 border border-zinc-800">⌫</kbd> to delete
        selected
      </div>
    </aside>
  );
}
