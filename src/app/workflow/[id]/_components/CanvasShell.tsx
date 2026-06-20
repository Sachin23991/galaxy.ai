"use client";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { useExecutionStore } from "@/store/useExecutionStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { NodePicker } from "./NodePicker";
import { Header } from "./Header";
import { BottomToolbar } from "./BottomToolbar";
import { HistoryPanel } from "./HistoryPanel";
import { GuidePanel } from "./GuidePanel";

interface Props {
  workflow: {
    id: string;
    name: string;
    nodesJson: string;
    edgesJson: string;
  };
}

export function CanvasShell({ workflow }: Props) {
  const hydrate = useWorkflowStore((s) => s.hydrate);
  const reset = useExecutionStore((s) => s.reset);
  const fetchRuns = useHistoryStore((s) => s.fetchRuns);
  const hydratedRef = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    requestAnimationFrame(() => {
      if (active) setMounted(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    let nodes: unknown[] = [];
    let edges: unknown[] = [];
    try {
      nodes = JSON.parse(workflow.nodesJson);
    } catch {}
    try {
      edges = JSON.parse(workflow.edgesJson);
    } catch {}
    hydrate({
      id: workflow.id,
      name: workflow.name,
      nodes,
      edges,
    });
    reset();
    void fetchRuns(workflow.id);
  }, [workflow, hydrate, reset, fetchRuns, mounted]);

  if (!mounted) {
    return (
      <div className="h-screen w-screen flex bg-[#f7f7f5] items-center justify-center font-sans">
        <div className="text-gray-400 text-sm font-medium">Loading canvas...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-[var(--background)] overflow-hidden">
      {/* Full-screen canvas */}
      <div className="flex-1 relative">
        <ReactFlowProvider>
          <WorkflowCanvas workflowId={workflow.id} />
          <NodePicker
            externalOpen={pickerOpen}
            onExternalClose={() => setPickerOpen(false)}
          />
        </ReactFlowProvider>

        {/* Floating Header */}
        <Header
          workflowId={workflow.id}
          onToggleHistory={() => setHistoryOpen((o) => !o)}
          historyOpen={historyOpen}
        />

        {/* Floating Left Guide Panel */}
        <GuidePanel />

        {/* Floating Bottom Toolbar */}
        <BottomToolbar
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          sidebarOpen={sidebarOpen}
          onOpenNodePicker={() => setPickerOpen(true)}
        />
      </div>

      {/* History Panel — slides in from right */}
      {historyOpen && (
        <div className="w-[340px] shrink-0 border-l border-gray-200 bg-white/80 backdrop-blur-md animate-in slide-in-from-right">
          <HistoryPanel workflowId={workflow.id} />
        </div>
      )}
    </div>
  );
}
