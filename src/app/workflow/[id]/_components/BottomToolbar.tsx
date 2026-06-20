"use client";
import { Copy, FileText, Layers, ChevronRight, Download, Upload, Undo2, Redo2 } from "lucide-react";
import { useRef } from "react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { cn } from "@/lib/cn";

interface Props {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onOpenNodePicker: () => void;
}

export function BottomToolbar({ onToggleSidebar, sidebarOpen, onOpenNodePicker }: Props) {
  const name = useWorkflowStore((s) => s.name);
  const exportJson = useWorkflowStore((s) => s.exportJson);
  const importJson = useWorkflowStore((s) => s.importJson);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const pastLen = useWorkflowStore((s) => s.past.length);
  const futureLen = useWorkflowStore((s) => s.future.length);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    importJson(text);
    e.target.value = "";
  };

  return (
    <div className="fixed bottom-5 left-0 right-0 z-40 flex items-center justify-between px-5 pointer-events-none animate-slide-up">
      {/* Left — Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className={cn(
          "nf-glass size-10 rounded-xl grid place-items-center pointer-events-auto transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md",
          sidebarOpen
            ? "text-violet-600 rotate-180"
            : "text-gray-500 hover:text-gray-900"
        )}
        title="Toggle sidebar"
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Center — Actions */}
      <div className="nf-glass rounded-xl px-2 py-1.5 flex items-center gap-1 pointer-events-auto shadow-md transition-shadow hover:shadow-lg">
        <button
          onClick={onExport}
          className="nf-toolbar-btn transition-transform hover:-translate-y-0.5 active:scale-95"
          title="Export workflow"
        >
          <Download className="size-4 transition-transform group-hover:scale-110" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="nf-toolbar-btn transition-transform hover:-translate-y-0.5 active:scale-95"
          title="Import workflow"
        >
          <Upload className="size-4 transition-transform group-hover:scale-110" />
        </button>
        <div className="h-5 w-px bg-gray-200 mx-0.5 transition-all duration-300" />
        
        {/* Canvas Undo / Redo */}
        <button
          disabled={pastLen === 0}
          onClick={undo}
          className="nf-toolbar-btn disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 text-gray-500 hover:text-gray-900 transition-transform hover:-translate-y-0.5 active:scale-95"
          title="Undo last action (node or connection)"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          disabled={futureLen === 0}
          onClick={redo}
          className="nf-toolbar-btn disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 text-gray-500 hover:text-gray-900 transition-transform hover:-translate-y-0.5 active:scale-95"
          title="Redo last action (node or connection)"
        >
          <Redo2 className="size-4" />
        </button>
        <div className="h-5 w-px bg-gray-200 mx-0.5 transition-all duration-300" />

        <button
          onClick={onOpenNodePicker}
          className="nf-toolbar-btn !w-10 !h-10 !rounded-xl border border-violet-100 bg-white hover:bg-violet-50/20 text-violet-600 font-extrabold shadow-[0_2px_12px_rgba(124,58,237,0.18)] hover:shadow-[0_2px_16px_rgba(124,58,237,0.28)] transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
          title="Add node"
        >
          <span className="text-xl leading-none font-bold transition-transform group-hover:rotate-90">+</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={onImport}
        />
      </div>

      {/* Right — Minimap placeholder */}
      <button
        className="nf-glass size-10 rounded-xl grid place-items-center pointer-events-auto text-gray-500 hover:text-gray-900 transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
        title="Minimap"
      >
        <Layers className="size-4" />
      </button>
    </div>
  );
}
