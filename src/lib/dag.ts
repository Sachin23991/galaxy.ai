/**
 * DAG utilities: topological level computation and cycle detection.
 *
 * Used by:
 *   - useWorkflowStore.addEdge (cycle guard)
 *   - trigger/run-workflow.ts orchestrator (level-by-level fan-out)
 */
import type { Edge, Node } from "@xyflow/react";

export type Level = number;
export type LevelMap = Record<string, Level>;

/**
 * Compute the topological "level" of every node (distance from a root).
 * Roots (no incoming edges) are level 0. Each subsequent level is
 * `parentLevel + 1` and we take the max over all parents.
 *
 * Returns a partial map if a cycle exists: any node participating in or
 * downstream of a cycle will be missing. Callers can detect this by
 * comparing keys to the input node set.
 */
export function computeLevels(
  nodes: ReadonlyArray<Pick<Node, "id">>,
  edges: ReadonlyArray<Pick<Edge, "source" | "target">>,
): LevelMap {
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n.id, []);
    indeg.set(n.id, 0);
  }
  for (const e of edges) {
    if (!adj.has(e.source) || !indeg.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  const levels: LevelMap = {};
  const queue: string[] = [];
  for (const n of nodes) {
    if ((indeg.get(n.id) ?? 0) === 0) {
      levels[n.id] = 0;
      queue.push(n.id);
    }
  }
  while (queue.length > 0) {
    const u = queue.shift()!;
    const lvl = levels[u] ?? 0;
    for (const v of adj.get(u) ?? []) {
      const newLvl = Math.max(levels[v] ?? -1, lvl + 1);
      levels[v] = newLvl;
      const remaining = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, remaining);
      if (remaining === 0) queue.push(v);
    }
  }
  return levels;
}

export function hasCycle(
  nodes: ReadonlyArray<Pick<Node, "id">>,
  edges: ReadonlyArray<Pick<Edge, "source" | "target">>,
): boolean {
  return Object.keys(computeLevels(nodes, edges)).length !== nodes.length;
}

/** Group node ids by their topological level. */
export function groupByLevel(
  nodes: ReadonlyArray<Pick<Node, "id">>,
  edges: ReadonlyArray<Pick<Edge, "source" | "target">>,
): LevelMap {
  const levels = computeLevels(nodes, edges);
  return levels;
}
