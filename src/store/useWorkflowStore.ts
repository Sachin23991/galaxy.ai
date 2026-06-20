/**
 * Workflow store — nodes, edges, undo/redo, hydration, edge guards.
 *
 * Edge guards:
 *   - hasCycle on addEdge → reject with toast.
 *   - Port compatibility is enforced earlier by React Flow's
 *     isValidConnection, but we double-check here.
 */
"use client";

import { create } from "zustand";
import {
  addEdge as rfAddEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import type { NodeData, NodeKind } from "@/lib/ports";
import { hasCycle } from "@/lib/dag";
import { isCompatible, splitPort } from "@/lib/ports";
import {
  exportWorkflowJson,
  importWorkflowJson,
} from "@/lib/exportImport";

export type WorkflowNode = Node<NodeData>;
export type WorkflowEdge = Edge;

interface Snapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowState {
  workflowId: string | null;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeIds: string[];
  recentNodeTypes: NodeKind[];
  past: Snapshot[];
  future: Snapshot[];
  hydrated: boolean;

  // hydration
  hydrate(args: {
    id: string;
    name: string;
    nodes: unknown[];
    edges: unknown[];
  }): void;
  resetForNew(id: string, name: string): void;

  // node ops
  addNode(
    type: NodeKind,
    position?: XYPosition,
  ): string;
  updateNodeData(id: string, patch: Partial<NodeData>): void;
  onNodesChange(changes: NodeChange<WorkflowNode>[]): void;
  onEdgesChange(changes: EdgeChange<WorkflowEdge>[]): void;
  removeNodes(ids: string[]): void;

  // edge ops
  onConnect(c: Connection): void;

  // history
  undo(): void;
  redo(): void;

  // meta
  setName(name: string): void;
  setSelected(ids: string[]): void;
  markRecent(t: NodeKind): void;

  // import/export
  exportJson(): string;
  importJson(text: string): boolean;

  // internal
  _push(): void;
}

const PRE_PLACED_REQUESTS: WorkflowNode = {
  id: "request-inputs",
  type: "requestInputs",
  position: { x: 80, y: 240 },
  deletable: false,
  data: {
    kind: "requestInputs",
    fields: [
      { id: "f1", type: "text", label: "text_field", value: "" },
    ],
  },
};

const PRE_PLACED_GEMINI: WorkflowNode = {
  id: "gemini-default",
  type: "gemini",
  position: { x: 480, y: 160 },
  deletable: true,
  data: {
    kind: "gemini",
    model: "gemini-3.1-pro",
    prompt: "",
    images: [],
    settingsOpen: false,
  },
};

const PRE_PLACED_RESPONSE: WorkflowNode = {
  id: "response",
  type: "response",
  position: { x: 980, y: 240 },
  deletable: false,
  data: { kind: "response" },
};

const DEFAULT_EDGES: WorkflowEdge[] = [
  {
    id: "edge-req-to-gemini",
    source: "request-inputs",
    sourceHandle: "field-f1:text",
    target: "gemini-default",
    targetHandle: "in-prompt:text",
    animated: true,
    type: "purple",
  },
  {
    id: "edge-gemini-to-resp",
    source: "gemini-default",
    sourceHandle: "out-text:text",
    target: "response",
    targetHandle: "in-result:text",
    animated: true,
    type: "purple",
  },
];

function defaultNodeData(type: NodeKind, position: XYPosition): WorkflowNode {
  const base = { position, deletable: type !== "requestInputs" && type !== "response" };
  if (type === "requestInputs") {
    return {
      ...base,
      id: `ri-${Math.random().toString(36).slice(2, 9)}`,
      type,
      data: {
        kind: "requestInputs",
        fields: [
          { id: "f1", type: "text", label: "text_field", value: "" },
        ],
      },
    };
  }
  if (type === "cropImage") {
    return {
      ...base,
      id: `crop-${Math.random().toString(36).slice(2, 9)}`,
      type,
      data: { kind: "cropImage", x: 0, y: 0, w: 100, h: 100 },
    };
  }
  if (type === "gemini") {
    return {
      ...base,
      id: `gemini-${Math.random().toString(36).slice(2, 9)}`,
      type,
      data: {
        kind: "gemini",
        model: "gemini-3.1-pro",
        prompt: "",
        images: [],
        settingsOpen: false,
      },
    };
  }
  return {
    ...base,
    id: `resp-${Math.random().toString(36).slice(2, 9)}`,
    type,
    data: { kind: "response" },
  };
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflowId: null,
  name: "Untitled workflow",
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  recentNodeTypes: [],
  past: [],
  future: [],
  hydrated: false,

  hydrate({ id, name, nodes, edges }) {
    const safeNodes = Array.isArray(nodes)
      ? (nodes as WorkflowNode[])
      : [];
    const safeEdges = Array.isArray(edges)
      ? (edges as WorkflowEdge[])
      : [];

    const isEmpty = safeNodes.length === 0;

    // Ensure pre-placed nodes are always present and undeletable
    const hasReq = safeNodes.some((n) => n.type === "requestInputs");
    const hasResp = safeNodes.some((n) => n.type === "response");
    const merged: WorkflowNode[] = [
      ...safeNodes,
      ...(hasReq ? [] : [PRE_PLACED_REQUESTS]),
      ...(hasResp ? [] : [PRE_PLACED_RESPONSE]),
    ];

    const mergedEdges = isEmpty && safeEdges.length === 0
      ? []
      : safeEdges;

    set({
      workflowId: id,
      name,
      nodes: merged,
      edges: mergedEdges,
      past: [],
      future: [],
      hydrated: true,
    });
  },

  resetForNew(id, name) {
    set({
      workflowId: id,
      name,
      nodes: [PRE_PLACED_REQUESTS, PRE_PLACED_RESPONSE],
      edges: [],
      past: [],
      future: [],
      hydrated: true,
    });
  },


  _push() {
    const { nodes, edges, past } = get();
    const snap: Snapshot = {
      nodes: nodes.map((n) => ({ ...n, data: { ...n.data } })),
      edges: edges.map((e) => ({ ...e })),
    };
    set({ past: [...past, snap].slice(-50), future: [] });
  },

  addNode(type, position) {
    if (type === "requestInputs" || type === "response") {
      // Pre-placed only — refuse to add manually.
      return "";
    }
    get()._push();
    const pos = position ?? {
      x: 300 + Math.random() * 200,
      y: 200 + Math.random() * 200,
    };
    const node = defaultNodeData(type, pos);
    set({
      nodes: [...get().nodes, node],
      recentNodeTypes: [
        type,
        ...get().recentNodeTypes.filter((t) => t !== type),
      ].slice(0, 6),
    });
    return node.id;
  },

  updateNodeData(id, patch) {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as WorkflowNode) : n,
      ),
    });
  },

  onNodesChange(changes) {
    let shouldPush = false;
    // Block deletes for the pre-placed nodes
    const filtered: NodeChange<WorkflowNode>[] = changes.map((c) => {
      if (c.type === "remove") {
        const target = get().nodes.find((n) => n.id === c.id);
        if (target && (target.type === "requestInputs" || target.type === "response")) {
          return { id: c.id, type: "position" as const, position: target.position };
        }
        shouldPush = true;
      }
      if (c.type === "position" && "dragging" in c && c.dragging === false) {
        shouldPush = true;
      }
      return c;
    });
    if (shouldPush) get()._push();
    set({ nodes: applyNodeChanges(filtered, get().nodes) as WorkflowNode[] });
  },

  onEdgesChange(changes) {
    if (changes.some((c) => c.type === "remove")) get()._push();
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  removeNodes(ids) {
    const setIds = new Set(ids);
    const blocked = get().nodes
      .filter((n) => setIds.has(n.id))
      .filter((n) => n.type === "requestInputs" || n.type === "response")
      .map((n) => n.id);
    const allowed = ids.filter((i) => !blocked.includes(i));
    if (allowed.length === 0) return;
    get()._push();
    set({
      nodes: get().nodes.filter((n) => !allowed.includes(n.id)),
      edges: get().edges.filter(
        (e) => !allowed.includes(e.source) && !allowed.includes(e.target),
      ),
    });
  },

  onConnect(c) {
    const sourceType = splitPort(c.sourceHandle ?? null);
    const targetType = splitPort(c.targetHandle ?? null);
    if (!isCompatible(sourceType, targetType)) {
      // Invalid port types — should already be blocked by React Flow.
      return;
    }
    const newEdges = rfAddEdge(
      { ...c, animated: true, type: "purple" },
      get().edges,
    );
    // Cycle check on the proposed edge set
    const proposed: { source: string; target: string }[] = newEdges.map(
      (e) => ({ source: e.source, target: e.target }),
    );
    if (hasCycle(get().nodes, proposed)) {
      // Reject
      if (typeof window !== "undefined") {
        console.warn("[NextFlow] edge rejected: would create a cycle");
      }
      return;
    }
    get()._push();
    set({ edges: newEdges });
  },

  undo() {
    const { past, nodes, edges, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1]!;
    set({
      past: past.slice(0, -1),
      nodes: prev.nodes,
      edges: prev.edges,
      future: [{ nodes, edges }, ...future].slice(0, 50),
    });
  },

  redo() {
    const { future, nodes, edges, past } = get();
    if (future.length === 0) return;
    const next = future[0]!;
    set({
      future: future.slice(1),
      nodes: next.nodes,
      edges: next.edges,
      past: [...past, { nodes, edges }].slice(-50),
    });
  },

  setName(name) {
    set({ name });
  },

  setSelected(ids) {
    set({ selectedNodeIds: ids });
  },

  markRecent(t) {
    set({
      recentNodeTypes: [
        t,
        ...get().recentNodeTypes.filter((x) => x !== t),
      ].slice(0, 6),
    });
  },

  exportJson() {
    return exportWorkflowJson(get().name, get().nodes, get().edges);
  },

  importJson(text) {
    try {
      const parsed = importWorkflowJson(text);
      const importedNodes = parsed.nodes as WorkflowNode[];
      const hasReq = importedNodes.some((n) => n.type === "requestInputs");
      const hasResp = importedNodes.some((n) => n.type === "response");
      set({
        name: parsed.name,
        nodes: [
          ...importedNodes,
          ...(hasReq ? [] : [PRE_PLACED_REQUESTS]),
          ...(hasResp ? [] : [PRE_PLACED_RESPONSE]),
        ],
        edges: parsed.edges as WorkflowEdge[],
        past: [],
        future: [],
      });
      return true;
    } catch (err) {
      console.error("Import failed:", err);
      return false;
    }
  },
}));
