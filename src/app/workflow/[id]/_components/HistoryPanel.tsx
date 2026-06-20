"use client";
import { useState, useEffect } from "react";
import { useHistoryStore, type Run, type NodeExecution } from "@/store/useHistoryStore";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, History, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  workflowId: string;
}

function StatusBadge({ status }: { status: Run["status"] | NodeExecution["status"] }) {
  const map: Record<Run["status"] | NodeExecution["status"], { color: string; icon: React.ReactNode; label: string }> = {
    success: {
      color: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
      icon: <CheckCircle2 className="size-3 text-emerald-600" />,
      label: "Success",
    },
    failed: {
      color: "bg-rose-50 text-rose-700 border-rose-200/60",
      icon: <XCircle className="size-3 text-rose-600" />,
      label: "Failed",
    },
    partial: {
      color: "bg-amber-50 text-amber-700 border-amber-200/60",
      icon: <AlertTriangle className="size-3 text-amber-600" />,
      label: "Partial",
    },
    running: {
      color: "bg-blue-50 text-blue-700 border-blue-200/60",
      icon: <Loader2 className="size-3 text-blue-600 animate-spin" />,
      label: "Running",
    },
    pending: {
      color: "bg-gray-50 text-gray-500 border-gray-250/50",
      icon: <Clock className="size-3 text-gray-400" />,
      label: "Pending",
    },
  };
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-sm",
        m.color,
      )}
    >
      {m.icon} {m.label}
    </span>
  );
}

function scopeLabel(scope: string) {
  if (scope === "full") return "Full Run";
  if (scope.startsWith("partial:")) return `Partial (${scope.slice(8).split(",").length} nodes)`;
  if (scope.startsWith("single:")) return "Single Node";
  return scope;
}

function durationMs(run: Run, now: number): number | null {
  if (!run.finishedAt) {
    if (run.status === "running") return now - new Date(run.startedAt).getTime();
    return null;
  }
  return new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
}

function formatRunTimestamp(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  
  if (isToday) {
    return `Today at ${timeStr}`;
  } else if (isYesterday) {
    return `Yesterday at ${timeStr}`;
  } else {
    const datePart = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    return `${datePart} at ${timeStr}`;
  }
}

export function HistoryPanel({ workflowId }: Props) {
  const runs = useHistoryStore((s) => s.runs);
  const fetchRuns = useHistoryStore((s) => s.fetchRuns);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    void fetchRuns(workflowId);
    const t = setInterval(() => {
      void fetchRuns(workflowId);
      setNow(globalThis.Date.now());
    }, 3000);
    return () => clearInterval(t);
  }, [workflowId, fetchRuns]);

  return (
    <aside className="w-full h-full flex flex-col bg-transparent overflow-hidden font-sans text-gray-800">
      {/* Panel Header */}
      <div className="px-4 py-3.5 border-b border-gray-250/60 bg-gray-50/50 flex items-center gap-2">
        <History className="size-4 text-violet-650" />
        <h2 className="text-sm font-bold text-gray-900 font-display">Run History</h2>
        <span className="ml-auto text-[10px] font-bold text-gray-500 bg-gray-200/60 border border-gray-300/30 px-2 py-0.5 rounded-full">
          {runs.length} run{runs.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto">
        {runs.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 font-medium">
            No runs yet — click the Play button to execute the workflow.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {runs.map((r) => {
              const isOpen = expanded === r.id;
              const dur = durationMs(r, now || new Date(r.startedAt).getTime());
              return (
                <li key={r.id} className={cn("px-4 py-3 transition-colors", isOpen ? "bg-gray-50/30" : "hover:bg-gray-50/20")}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">
                        {isOpen ? (
                          <ChevronDown className="size-4 text-gray-400 hover:text-gray-600 transition-colors" />
                        ) : (
                          <ChevronRight className="size-4 text-gray-400 hover:text-gray-600 transition-colors" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-gray-900">
                          {formatRunTimestamp(r.startedAt)}
                        </div>
                        <div className="text-[10px] font-semibold text-gray-400 mt-1 flex items-center gap-1.5">
                          <span className="bg-gray-100/80 px-1.5 py-0.5 rounded text-gray-500 border border-gray-200/50">{scopeLabel(r.scope)}</span>
                          {dur !== null && (
                            <span className="text-gray-500 font-medium flex items-center gap-0.5">
                              <Clock className="size-2.5 text-gray-400" />
                              {dur < 1000 ? `${Math.round(dur)}ms` : `${(dur / 1000).toFixed(1)}s`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-3 pl-6 pr-1 space-y-2.5 border-l border-dashed border-gray-200 ml-2.5 animate-in fade-in duration-200">
                      {r.executions.length === 0 ? (
                        <div className="text-[10px] text-gray-400 italic font-medium py-1">
                          No node executions recorded.
                        </div>
                      ) : (
                        r.executions.map((e) => (
                          <ExecutionRow key={e.id} exec={e} now={now} />
                        ))
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function ExecutionRow({ exec, now }: { exec: NodeExecution; now: number }) {
  const dur =
    exec.startedAt && exec.finishedAt
      ? new Date(exec.finishedAt).getTime() - new Date(exec.startedAt).getTime()
      : exec.startedAt && exec.status === "running"
        ? (now || new Date(exec.startedAt).getTime()) - new Date(exec.startedAt).getTime()
        : null;
  const inputSummary = exec.inputsJson ? safeJsonSummary(exec.inputsJson) : null;
  const outputSummary = exec.outputJson ? safeJsonSummary(exec.outputJson) : null;

  return (
    <div className="rounded-xl border border-gray-250/60 bg-white/95 p-3 shadow-sm hover:shadow transition-all space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold font-mono text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-150 flex-1 truncate">
          {exec.nodeId}
        </span>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {exec.nodeType}
        </span>
        {dur !== null && (
          <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
            {dur < 1000 ? `${Math.round(dur)}ms` : `${(dur / 1000).toFixed(1)}s`}
          </span>
        )}
        <StatusBadge status={exec.status} />
      </div>
      
      {inputSummary && (
        <div className="text-[10px] text-gray-500">
          <span className="font-bold text-gray-400 block text-[9px] uppercase tracking-wider mb-0.5 font-sans">Inputs</span>
          <pre className="bg-gray-50/50 p-2 rounded-lg font-mono text-[9px] leading-relaxed border border-gray-100 overflow-x-auto max-w-full whitespace-pre-wrap">
            {inputSummary}
          </pre>
        </div>
      )}
      
      {outputSummary && (
        <div className="text-[10px] text-gray-500">
          <span className="font-bold text-emerald-600 block text-[9px] uppercase tracking-wider mb-0.5 font-sans">Output</span>
          <pre className="bg-emerald-50/30 p-2 rounded-lg font-mono text-[9px] leading-relaxed text-emerald-800 border border-emerald-100/50 overflow-x-auto max-w-full whitespace-pre-wrap font-bold">
            {outputSummary}
          </pre>
        </div>
      )}
      
      {exec.error && (
        <div className="text-[10px]">
          <span className="font-bold text-rose-500 block text-[9px] uppercase tracking-wider mb-0.5 font-sans">Error</span>
          <pre className="bg-rose-50/30 p-2 rounded-lg font-mono text-[9px] leading-relaxed text-rose-700 border border-rose-100 overflow-x-auto max-w-full whitespace-pre-wrap font-bold">
            {exec.error}
          </pre>
        </div>
      )}
    </div>
  );
}

function safeJsonSummary(json: string): string {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") {
      // Custom cleanups
      const clone = { ...parsed } as Record<string, unknown>;
      for (const key of Object.keys(clone)) {
        const val = clone[key];
        if (typeof val === "string") {
          if (val.startsWith("data:image/")) {
            clone[key] = `${val.slice(0, 30)}... [Base64 Image Data]`;
          } else if (val.length > 500) {
            clone[key] = val.slice(0, 500) + "... [truncated]";
          }
        }
      }
      
      if ("outputText" in clone && typeof clone.outputText === "string") {
        return clone.outputText;
      }
      if ("captured" in clone && typeof clone.captured === "string") {
        return clone.captured;
      }
      if ("outputImage" in clone && typeof clone.outputImage === "string") {
        return clone.outputImage;
      }
      
      return JSON.stringify(clone, null, 2);
    }
    return String(parsed);
  } catch {
    if (json.startsWith("data:image/")) {
      return `${json.slice(0, 30)}... [Base64 Image Data]`;
    }
    return json;
  }
}
