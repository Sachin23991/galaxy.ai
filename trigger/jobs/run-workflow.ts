/**
 * Trigger.dev v4 orchestrator task. Spawns a `run-workflow` task that:
 *   1. Computes DAG levels.
 *   2. Launches all leaf tasks at the same level concurrently.
 *   3. Resolves node inputs dynamically from execution outputs.
 *   4. Reports real-time status updates via secure webhooks back to Next.js.
 */
import { task } from "@trigger.dev/sdk/v3";
import { cropImageTask } from "./crop-image";
import { geminiTask } from "./gemini";

interface RunWorkflowPayload {
  runId: string;
  workflowId: string;
  nodes: { id: string; type: string; data?: unknown }[];
  edges: { source: string; target: string; sourceHandle?: string; targetHandle?: string }[];
  scope: "full" | { type: "partial"; nodeIds: string[] } | { type: "single"; nodeId: string };
  nodePayloads: Record<string, unknown>;
  appUrl: string;
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

    // Simple level computation
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
      const triggers: Promise<
        { ok: true; output: unknown } | { ok: false; error: unknown }
      >[] = [];

      for (const id of ids) {
        const node = payload.nodes.find((n) => n.id === id);
        if (!node) continue;

        const inputs = resolveInputs(node, payload.edges, payload.nodes, results);

        if (node.type === "requestInputs") {
          await sendWebhook(payload.appUrl, {
            action: "node-start",
            runId: payload.runId,
            nodeId: id,
            inputs,
          });

          const data = (node.data ?? {}) as {
            fields?: { id: string; label: string; value: string }[];
          };
          const output = Object.fromEntries(
            (data.fields ?? []).map((field) => [field.label || field.id, field.value]),
          );

          results[id] = output;

          await sendWebhook(payload.appUrl, {
            action: "node-success",
            runId: payload.runId,
            nodeId: id,
            output,
          });
          continue;
        }

        if (node.type === "response") {
          await sendWebhook(payload.appUrl, {
            action: "node-start",
            runId: payload.runId,
            nodeId: id,
            inputs,
          });

          const captured = firstStringInput(inputs);
          const output = { captured };
          results[id] = captured;

          await sendWebhook(payload.appUrl, {
            action: "node-success",
            runId: payload.runId,
            nodeId: id,
            output,
          });
          continue;
        }

        if (node.type === "cropImage") {
          const data = (node.data ?? {}) as { x: number; y: number; w: number; h: number; inputImage?: string };
          const nodePayload = {
            inputImage: firstString(inputs["in-image"]) ?? data.inputImage ?? "",
            x: Number(firstScalar(inputs["in-x"]) ?? data.x),
            y: Number(firstScalar(inputs["in-y"]) ?? data.y),
            w: Number(firstScalar(inputs["in-w"]) ?? data.w),
            h: Number(firstScalar(inputs["in-h"]) ?? data.h),
          };

          triggerIds.push(id);
          triggers.push(
            (async () => {
              await sendWebhook(payload.appUrl, {
                action: "node-start",
                runId: payload.runId,
                nodeId: id,
                inputs,
              });

              try {
                const handle = await cropImageTask.triggerAndWait({
                  runId: payload.runId,
                  nodeId: id,
                  ...nodePayload,
                });
                if (handle.ok) {
                  await sendWebhook(payload.appUrl, {
                    action: "node-success",
                    runId: payload.runId,
                    nodeId: id,
                    output: handle.output,
                  });
                  return { ok: true, output: handle.output };
                } else {
                  const errMsg = String(handle.error ?? "Unknown crop task failure");
                  await sendWebhook(payload.appUrl, {
                    action: "node-failure",
                    runId: payload.runId,
                    nodeId: id,
                    error: errMsg,
                  });
                  return { ok: false, error: errMsg };
                }
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                await sendWebhook(payload.appUrl, {
                  action: "node-failure",
                  runId: payload.runId,
                  nodeId: id,
                  error: errMsg,
                });
                return { ok: false, error: errMsg };
              }
            })()
          );
          continue;
        }

        if (node.type === "gemini") {
          const data = (node.data ?? {}) as {
            model: string;
            prompt: string;
            systemPrompt?: string;
            images: string[];
            video?: string;
            audio?: string;
            file?: string;
            maxWords?: number;
          };
          const nodePayload = {
            model: data.model,
            prompt: firstString(inputs["in-prompt"]) ?? data.prompt,
            systemPrompt: firstString(inputs["in-system"]) ?? data.systemPrompt,
            images: strings(inputs["in-image"], data.images),
            video: firstString(inputs["in-video"]) ?? data.video,
            audio: firstString(inputs["in-audio"]) ?? data.audio,
            file: firstString(inputs["in-file"]) ?? data.file,
            maxWords: data.maxWords,
          };

          triggerIds.push(id);
          triggers.push(
            (async () => {
              await sendWebhook(payload.appUrl, {
                action: "node-start",
                runId: payload.runId,
                nodeId: id,
                inputs,
              });

              try {
                const handle = await geminiTask.triggerAndWait({
                  runId: payload.runId,
                  nodeId: id,
                  ...nodePayload,
                });
                if (handle.ok) {
                  await sendWebhook(payload.appUrl, {
                    action: "node-success",
                    runId: payload.runId,
                    nodeId: id,
                    output: handle.output,
                  });
                  return { ok: true, output: handle.output };
                } else {
                  const errMsg = String(handle.error ?? "Unknown gemini task failure");
                  await sendWebhook(payload.appUrl, {
                    action: "node-failure",
                    runId: payload.runId,
                    nodeId: id,
                    error: errMsg,
                  });
                  return { ok: false, error: errMsg };
                }
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                await sendWebhook(payload.appUrl, {
                  action: "node-failure",
                  runId: payload.runId,
                  nodeId: id,
                  error: errMsg,
                });
                return { ok: false, error: errMsg };
              }
            })()
          );
        }
      }

      if (triggers.length === 0) continue;
      const handles = await Promise.all(triggers);
      
      let levelHasError = false;
      handles.forEach((h, i) => {
        const id = triggerIds[i]!;
        results[id] = h.ok ? h.output : { error: h.error };
        if (!h.ok) {
          levelHasError = true;
        }
      });

      if (levelHasError) {
        // Break out of the loop and don't execute subsequent levels if any node in this level failed
        break;
      }
    }

    const totalFailed = Object.values(results).some((r) => r && typeof r === "object" && "error" in r);
    const finalStatus = totalFailed ? "failed" : "success";

    await sendWebhook(payload.appUrl, {
      action: "run-finish",
      runId: payload.runId,
      finalStatus,
    });

    return { results };
  },
});

async function sendWebhook(appUrl: string, payload: Record<string, unknown>) {
  const secretKey = process.env.TRIGGER_SECRET_KEY || "";
  try {
    const url = `${appUrl.replace(/\/$/, "")}/api/runs/webhook`;
    console.log(`[Webhook] Sending action "${payload.action}" to ${url}`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-trigger-secret": secretKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[Webhook] Failed to notify Next.js for action ${payload.action}: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`[Webhook] Error sending webhook to Next.js for action ${payload.action}:`, err);
  }
}

function resolveInputs(
  node: { id: string; type: string; data?: unknown },
  edges: { source: string; target: string; sourceHandle?: string; targetHandle?: string }[],
  nodes: { id: string; type: string; data?: unknown }[],
  results: Record<string, unknown>,
): Record<string, unknown> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const ins = edges.filter((e) => e.target === node.id);

  const out: Record<string, unknown> = {};
  for (const edge of ins) {
    const source = nodeById.get(edge.source);
    if (!source) continue;
    const value = valueFromSource(source, edge.sourceHandle ?? null, results);
    if (value === undefined || value === null || value === "") continue;
    const key = (edge.targetHandle ?? "in").split(":")[0] ?? "in";
    appendInput(out, key, value);
  }

  if (node.type === "cropImage") {
    const data = (node.data ?? {}) as {
      inputImage?: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
    };
    out["in-image"] ??= data.inputImage;
    out["in-x"] ??= data.x ?? 0;
    out["in-y"] ??= data.y ?? 0;
    out["in-w"] ??= data.w ?? 100;
    out["in-h"] ??= data.h ?? 100;
  }

  if (node.type === "gemini") {
    const data = (node.data ?? {}) as {
      prompt?: string;
      systemPrompt?: string;
      images?: string[];
      video?: string;
      audio?: string;
      file?: string;
    };
    out["in-prompt"] ??= data.prompt ?? "";
    out["in-system"] ??= data.systemPrompt ?? "";
    out["in-image"] ??= (data.images ?? []).filter(Boolean);
    out["in-video"] ??= data.video ?? "";
    out["in-audio"] ??= data.audio ?? "";
    out["in-file"] ??= data.file ?? "";
  }

  return out;
}

function appendInput(out: Record<string, unknown>, key: string, value: unknown) {
  if (out[key] === undefined) {
    out[key] = value;
    return;
  }
  const current = out[key];
  out[key] = Array.isArray(current) ? [...current, value] : [current, value];
}

function valueFromSource(
  source: { id: string; type: string; data?: unknown },
  sourceHandle: string | null,
  results: Record<string, unknown>,
) {
  if (source.type === "requestInputs") {
    const data = (source.data ?? {}) as {
      fields?: { id: string; label: string; value: string }[];
    };
    const fieldId = sourceHandle?.split(":")[0]?.replace(/^field-/, "");
    return data.fields?.find((field) => field.id === fieldId)?.value;
  }

  const result = results[source.id];
  const data = (source.data ?? {}) as Record<string, unknown>;
  if (sourceHandle?.startsWith("out-image")) {
    return objectValue(result, "outputImage") ?? data.outputImage;
  }
  if (sourceHandle?.startsWith("out-text")) {
    return objectValue(result, "outputText") ?? data.result ?? data.captured;
  }
  return objectValue(result, "outputText") ?? objectValue(result, "outputImage") ?? result;
}

function objectValue(value: unknown, key: string) {
  if (value && typeof value === "object" && key in value) {
    return (value as Record<string, unknown>)[key];
  }
  return undefined;
}

function firstScalar(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function firstString(value: unknown) {
  const scalar = firstScalar(value);
  return typeof scalar === "string" ? scalar : undefined;
}

function strings(value: unknown, fallback: string[] = []) {
  const values = Array.isArray(value) ? value : value ? [value] : fallback;
  return values.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function firstStringInput(inputs: Record<string, unknown>) {
  for (const value of Object.values(inputs)) {
    if (typeof value === "string" && value.length > 0) return value;
    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === "string" && item.length > 0);
      if (typeof first === "string") return first;
    }
    const outputText = objectValue(value, "outputText");
    if (typeof outputText === "string" && outputText.length > 0) return outputText;
  }
  return "";
}
