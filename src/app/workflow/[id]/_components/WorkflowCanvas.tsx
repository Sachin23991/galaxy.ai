"use client";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type Connection,
} from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { isCompatible, splitPort } from "@/lib/ports";
import { hasCycle } from "@/lib/dag";
import { RequestInputsNode } from "./nodes/RequestInputsNode";
import { CropImageNode } from "./nodes/CropImageNode";
import { GeminiNode } from "./nodes/GeminiNode";
import { ResponseNode } from "./nodes/ResponseNode";
import { UnifiedAnimatedEdge } from "./edges/UnifiedAnimatedEdge";


const nodeTypes = {
  requestInputs: RequestInputsNode,
  cropImage: CropImageNode,
  gemini: GeminiNode,
  response: ResponseNode,
};

const edgeTypes = { purple: UnifiedAnimatedEdge };


interface Props {
  workflowId: string;
}

export function WorkflowCanvas({ workflowId }: Props) {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const name = useWorkflowStore((s) => s.name);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const setSelected = useWorkflowStore((s) => s.setSelected);

  const hydrated = useWorkflowStore((s) => s.hydrated);
  const prevSnapshotRef = useRef<string>("");

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Autosave: debounced PATCH on store changes — guarded by hydration state
  useEffect(() => {
    if (!hydrated || !workflowId) return;

    // Build a snapshot key to detect actual changes
    const snapshot = JSON.stringify({ name, nodes, edges });

    // Skip the very first render after hydration (the store just loaded from DB)
    if (prevSnapshotRef.current === "") {
      prevSnapshotRef.current = snapshot;
      return;
    }

    // Skip if nothing actually changed
    if (snapshot === prevSnapshotRef.current) return;
    prevSnapshotRef.current = snapshot;

    const id = setTimeout(() => {
      const { name, nodes, edges } = useWorkflowStore.getState();
      void fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          nodesJson: JSON.stringify(nodes),
          edgesJson: JSON.stringify(edges),
        }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(id);
  }, [name, nodes, edges, workflowId, hydrated]);

  // Flush save on tab close / refresh
  useEffect(() => {
    if (!workflowId) return;
    const onBeforeUnload = () => {
      const { name, nodes, edges } = useWorkflowStore.getState();
      // navigator.sendBeacon doesn't support custom headers, so use fetch with keepalive
      fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          nodesJson: JSON.stringify(nodes),
          edgesJson: JSON.stringify(edges),
        }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [workflowId]);

  const isValidConnection = useMemo(
    () => (c: Edge | Connection) => {
      if (!("sourceHandle" in c)) return true;
      const s = splitPort(c.sourceHandle ?? null);
      const t = splitPort(c.targetHandle ?? null);
      if (!isCompatible(s, t)) return false;
      if (!c.source || !c.target) return true;
      return !hasCycle(nodes, [...edges, { source: c.source, target: c.target }]);
    },
    [edges, nodes],
  );

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <ReactFlow
        nodes={nodes as unknown as Node[]}
        edges={edges as unknown as Edge[]}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={(changes) => onNodesChange(changes as never)}
        onEdgesChange={(changes) => onEdgesChange(changes as never)}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onSelectionChange={({ nodes }) => setSelected(nodes.map((n) => n.id))}
        defaultEdgeOptions={{ type: "purple", animated: true }}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode={["Meta", "Shift"]}
        selectionKeyCode={["Shift"]}
        snapToGrid
        snapGrid={[16, 16]}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#d4d4d2"
        />
        <Controls
          showInteractive={false}
          position="bottom-left"
          style={{ marginBottom: 72 }}
        />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          style={{ marginBottom: 72 }}
          maskColor="rgba(247,247,245,0.6)"
          nodeColor={(n) => {
            switch (n.type) {
              case "requestInputs":
                return "#f59e0b";
              case "cropImage":
                return "#3b82f6";
              case "gemini":
                return "#7c3aed";
              case "response":
                return "#10b981";
              default:
                return "#d4d4d8";
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}
