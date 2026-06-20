/**
 * Trigger.dev v4 orchestrator task. Spawns a `run-workflow` task that:
 *   1. Computes DAG levels.
 *   2. Launches all leaf tasks at the same level concurrently
 *      so siblings run concurrently.
 *   3. Persists results via webhook back to Next.js.
 *
 * This task is intentionally a thin wrapper — the real orchestration logic
 * lives in the leaf task bodies. The next.js /api/runs route is what calls
 * this in production.
 */
import { task } from "@trigger.dev/sdk/v3";
import { cropImageTask } from "./crop-image";
import { geminiTask } from "./gemini";

interface RunWorkflowPayload {
  runId: string;
  workflowId: string;
  nodes: { id: string; type: string }[];
  edges: { source: string; target: string }[];
  scope: "full" | { type: "partial"; nodeIds: string[] } | { type: "single"; nodeId: string };
  nodePayloads: Record<string, unknown>;
}

export const runWorkflowTask = task({
  id: "run-workflow",
  maxDuration: 600,
  run: async (payload: RunWorkflowPayload) => {
    const inScope = (id: string) => {
      if (payload.scope === "full") return true;
      if (typeof payload.scope === "object" && payload.scope.type === "partial") {
        return payload.scope.nodeIds.includes(id);
      }
      if (typeof payload.scope === "object" && payload.scope.type === "single") {
        return payload.scope.nodeId === id;
      }
      return false;
    };

    // Simple level computation (mirror of src/lib/dag.ts)
    const adj = new Map<string, string[]>();
    const indeg = new Map<string, number>();
    for (const n of payload.nodes) {
      adj.set(n.id, []);
      indeg.set(n.id, 0);
    }
    for (const e of payload.edges) {
      if (!adj.has(e.source) || !indeg.has(e.target)) continue;
      adj.get(e.source)!.push(e.target);
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
    const levels: Record<string, number> = {};
    const q: string[] = [];
    for (const n of payload.nodes) {
      if ((indeg.get(n.id) ?? 0) === 0) {
        levels[n.id] = 0;
        q.push(n.id);
      }
    }
    while (q.length) {
      const u = q.shift()!;
      for (const v of adj.get(u) ?? []) {
        levels[v] = Math.max(levels[v] ?? -1, (levels[u] ?? 0) + 1);
        if ((indeg.get(v) ?? 0) - 1 === 0) q.push(v);
        indeg.set(v, (indeg.get(v) ?? 0) - 1);
      }
    }

    const byLevel = new Map<number, string[]>();
    for (const n of payload.nodes) {
      if (!inScope(n.id)) continue;
      const lvl = levels[n.id];
      if (lvl === undefined) continue;
      const arr = byLevel.get(lvl) ?? [];
      arr.push(n.id);
      byLevel.set(lvl, arr);
    }

    const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b);
    const results: Record<string, unknown> = {};

    for (const lvl of sortedLevels) {
      const ids = byLevel.get(lvl) ?? [];
      const triggerIds: string[] = [];
      const triggers: PromiseLike<
        { ok: true; output: unknown } | { ok: false; error: unknown }
      >[] = [];

      for (const id of ids) {
        const node = payload.nodes.find((n) => n.id === id);
        const data = payload.nodePayloads[id] as Record<string, unknown> | undefined;
        if (node?.type === "cropImage" && data) {
          triggerIds.push(id);
          triggers.push(
            cropImageTask.triggerAndWait({
              runId: payload.runId,
              nodeId: id,
              inputImage: String(data["in-image"] ?? data.inputImage ?? ""),
              x: Number(data["in-x"] ?? data.x ?? 0),
              y: Number(data["in-y"] ?? data.y ?? 0),
              w: Number(data["in-w"] ?? data.w ?? 100),
              h: Number(data["in-h"] ?? data.h ?? 100),
            }),
          );
          continue;
        }
        if (node?.type === "gemini" && data) {
          triggerIds.push(id);
          triggers.push(
            geminiTask.triggerAndWait({
              runId: payload.runId,
              nodeId: id,
              model: String(data.model ?? "gemini-2.5-pro"),
              prompt: String(data["in-prompt"] ?? data.prompt ?? ""),
              systemPrompt: data["in-system"] as string | undefined,
              images: (data.images as string[] | undefined) ?? [],
              video: data.video as string | undefined,
              audio: data.audio as string | undefined,
              file: data.file as string | undefined,
            }),
          );
        }
      }

      if (triggers.length === 0) continue;
      const handles = await Promise.all(triggers);
      handles.forEach((h, i) => {
        const id = triggerIds[i]!;
        results[id] = h.ok ? h.output : { error: h.error };
      });
    }

    return { results };
  },
});
