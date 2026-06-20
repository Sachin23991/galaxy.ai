"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, ArrowRight, Workflow } from "lucide-react";
import { cn } from "@/lib/cn";

interface WorkflowRow {
  id: string;
  name: string;
  updatedAt: string;
  running: boolean;
}

export function DashboardClient({
  initialWorkflows,
}: {
  initialWorkflows: WorkflowRow[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<WorkflowRow[] | null>(initialWorkflows);
  const [, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    requestAnimationFrame(() => {
      if (active) setMounted(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const refresh = async () => {
    try {
      const res = await fetch(`/api/workflows?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.workflows);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setItems((current) => current ?? []);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/workflows?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { workflows: WorkflowRow[] }) => setItems(data.workflows))
      .catch((err: unknown) => {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
          setItems((current) => current ?? []);
        }
      });
    return () => controller.abort();
  }, [router]);

  const onCreate = async () => {
    setError(null);
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      setError(`Failed to create (${res.status})`);
      return;
    }
    const data = await res.json();
    router.refresh();
    startTransition(() => router.push(`/workflow/${data.workflow.id}`));
  };

  const onRename = async () => {
    if (!renaming) return;
    const res = await fetch(`/api/workflows/${renaming.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renaming.value }),
    });
    if (res.ok) {
      setRenaming(null);
      void refresh();
    } else {
      setError(`Rename failed (${res.status})`);
    }
  };

  const executeDelete = async (id: string) => {
    const previousItems = items;
    // Optimistically remove from state
    setItems((current) => current ? current.filter((w) => w.id !== id) : null);
    setError(null);

    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`Delete failed (${res.status})`);
      }
      void refresh();
    } catch (err) {
      setError((err as Error).message);
      setItems(previousItems);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-gray-800 font-sans">
      <header className="border-b border-gray-250/80 bg-white px-6 py-4 flex items-center gap-3 shadow-sm">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-85 transition-opacity cursor-pointer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/ChatGPT Image Jun 19, 2026, 04_29_44 PM (1).png" 
            alt="NextFlow Icon" 
            className="size-8 rounded-lg object-contain shadow-sm border border-gray-100"
          />
          <h1 className="text-lg font-extrabold tracking-tight text-gray-900 font-display">NextFlow</h1>
        </Link>
        <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-2">workflows</span>
        <div className="ml-auto">
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 text-sm font-semibold shadow-sm shadow-violet-100 transition-all cursor-pointer"
          >
            <Plus className="size-4" /> New workflow
          </button>
        </div>
      </header>

      <main className={cn("max-w-6xl mx-auto p-8", mounted && "animate-fade-in")}>
        <div className="space-y-8">
          {/* Welcome / Hero Banner */}
          <div className={cn(
            "relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-white shadow-xl shadow-violet-100/40 border border-violet-500/20",
            mounted && "animate-scale-in"
          )}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
            <div className="relative z-10 max-w-xl">
              <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">
                Compose Multimodal Workflows
              </h2>
              <p className="text-violet-100 text-sm leading-relaxed mb-6 font-medium">
                Visually build, connect, and execute robust AI pipelines combining crop tasks and Google Gemini 3.1 Pro LLM components.
              </p>
              <button
                onClick={onCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-violet-50 text-violet-700 px-5 py-2.5 text-xs font-bold shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer active:scale-95"
              >
                <Plus className="size-4" /> Create new workflow
              </button>
            </div>
            {/* Decorative layout element */}
            <div className={cn("absolute right-8 bottom-0 translate-y-6 opacity-10 hidden md:block", mounted && "animate-float")}>
              <Workflow className="size-64" />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          )}

          {items === null ? (
            <div className="text-gray-400 text-sm py-16 text-center font-medium">Loading…</div>
          ) : items.length === 0 ? (
            <div className={cn(mounted && "animate-slide-up")}>
              <EmptyState onCreate={onCreate} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((w, index) => (
                <div
                  key={w.id}
                  style={mounted ? { animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' } : undefined}
                  className={cn(
                    "group relative flex flex-col justify-between p-6 rounded-2xl border border-gray-200/80 bg-white shadow-sm hover:shadow-md hover:border-violet-300 transition-all duration-300 hover:-translate-y-1",
                    mounted ? "opacity-0 animate-slide-up" : "opacity-100"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="size-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100/50 group-hover:bg-violet-650 group-hover:text-white transition-all duration-300 shadow-sm">
                      <Workflow className="size-5" />
                    </div>
                    {/* Action buttons (rename, delete) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <IconButton
                        title="Rename"
                        onClick={() => setRenaming({ id: w.id, value: w.name })}
                      >
                        <Pencil className="size-3.5" />
                      </IconButton>
                      <IconButton
                        title="Delete"
                        onClick={() => setDeleteConfirmId(w.id)}
                      >
                        <Trash2 className="size-3.5 text-rose-500" />
                      </IconButton>
                    </div>
                  </div>

                  <div className="mt-4 flex-1">
                    {renaming?.id === w.id ? (
                      <div className="space-y-2 mt-1">
                        <input
                          autoFocus
                          value={renaming.value}
                          onChange={(e) =>
                            setRenaming({ id: w.id, value: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void onRename();
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          className="w-full bg-white border border-gray-305 rounded-lg px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-900 font-sans"
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={onRename}
                            className="text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 transition-colors cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setRenaming(null)}
                            className="text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 bg-white px-3 py-1.5 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Link
                          href={`/workflow/${w.id}`}
                          className="block font-bold text-gray-900 hover:text-violet-600 transition-colors text-[16px] leading-tight font-display mb-1 cursor-pointer"
                        >
                          {w.name}
                        </Link>
                        <span className="text-[10px] text-gray-400 font-mono select-all">ID: {w.id}</span>
                      </>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-450 font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span>Edited</span>
                      <span className="text-gray-600 font-bold">{mounted ? new Date(w.updatedAt).toLocaleDateString() : ""}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {w.running && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] text-amber-700 font-semibold animate-pulse">
                          <span className="size-1.5 rounded-full bg-amber-500" />
                          Running
                        </span>
                      )}
                      <Link
                        href={`/workflow/${w.id}`}
                        className="size-8 rounded-lg bg-gray-50 hover:bg-violet-50 hover:text-violet-600 border border-gray-200 flex items-center justify-center text-gray-600 transition-all duration-200 cursor-pointer"
                        title="Open Canvas"
                      >
                        <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-gray-150 p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="size-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Delete workflow?</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              Are you sure you want to delete this workflow? This action is permanent and cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const id = deleteConfirmId;
                  setDeleteConfirmId(null);
                  void executeDelete(id);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm shadow-rose-100 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="size-9 grid place-items-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all cursor-pointer border border-transparent hover:border-gray-200"
    >
      {children}
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-16 text-center bg-white shadow-sm">
      <div className="mx-auto size-12 rounded-xl bg-violet-500/10 grid place-items-center mb-4 text-violet-600 shadow-inner">
        <Workflow className="size-6" />
      </div>
      <h2 className="text-lg font-bold text-gray-950 font-display">No workflows yet</h2>
      <p className="text-sm text-gray-400 mt-1 mb-6 max-w-sm mx-auto font-medium">
        Create your first LLM workflow to start building.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 text-sm font-semibold shadow-sm transition-colors cursor-pointer"
      >
        <Plus className="size-4" /> New workflow
      </button>
    </div>
  );
}
