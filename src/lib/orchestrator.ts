/**
 * Workflow executor.
 *
 * In production, executable leaves can be dispatched through Trigger.dev when
 * Trigger credentials are present. The local leaf fallback keeps the demo
 * runnable without external services while preserving the same node contract.
 */
import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { Edge, Node } from "@xyflow/react";
import { prisma } from "@/lib/db";
import { cropImageLeaf } from "./trigger-tasks/crop-image";
import { geminiLeaf } from "./trigger-tasks/gemini";
import type { cropImageTask } from "../../trigger/jobs/crop-image";
import type { geminiTask } from "../../trigger/jobs/gemini";

export type Scope =
  | { type: "full" }
  | { type: "partial"; nodeIds: string[] }
  | { type: "single"; nodeId: string };

export interface OrchestratorArgs {
  runId: string;
  workflowId: string;
  nodes: Node[];
  edges: Edge[];
  scope: Scope;
  onNodeStart: (nodeId: string, inputs: Record<string, unknown>) => Promise<void> | void;
  onNodeSuccess: (
    nodeId: string,
    output: unknown,
    inputs: Record<string, unknown>,
  ) => Promise<void> | void;
  onNodeFailure: (
    nodeId: string,
    err: string,
    inputs: Record<string, unknown>,
  ) => Promise<void> | void;
}

type LeafState =
  | { status: "success"; output?: unknown }
  | { status: "failed"; error: string };

export async function orchestrate(args: OrchestratorArgs) {
  const { nodes, edges, scope } = args;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const scopedNodes = nodes.filter((node) => isInScope(node.id, scope));
  const scopedIds = new Set(scopedNodes.map((node) => node.id));

  const incoming = new Map<string, Edge[]>();
  const outgoingScoped = new Map<string, Edge[]>();
  for (const edge of edges) {
    const targetList = incoming.get(edge.target) ?? [];
    targetList.push(edge);
    incoming.set(edge.target, targetList);

    if (scopedIds.has(edge.source) && scopedIds.has(edge.target)) {
      const sourceList = outgoingScoped.get(edge.source) ?? [];
      sourceList.push(edge);
      outgoingScoped.set(edge.source, sourceList);
    }
  }

  const remainingParents = new Map<string, number>();
  for (const node of scopedNodes) {
    const count = (incoming.get(node.id) ?? []).filter((edge) =>
      scopedIds.has(edge.source),
    ).length;
    remainingParents.set(node.id, count);
  }

  const results: Record<string, unknown> = {};
  const leafResults: Record<string, LeafState> = {};
  const completed = new Set<string>();
  const failed = new Set<string>();

  if (scopedNodes.length === 0) {
    return { results, leafResults };
  }

  await new Promise<void>((resolve) => {
    const launch = (node: Node) => {
      void runNode(node)
        .catch(() => {
          // runNode records its own failure, so this is only a last-resort guard.
        })
        .finally(() => {
          completed.add(node.id);
          if (!failed.has(node.id)) {
            for (const edge of outgoingScoped.get(node.id) ?? []) {
              const nextCount = (remainingParents.get(edge.target) ?? 1) - 1;
              remainingParents.set(edge.target, nextCount);
              if (nextCount === 0) {
                const next = nodeById.get(edge.target);
                if (next) launch(next);
              }
            }
          }
          // The run resolves if all scoped nodes are completed OR if there are failures,
          // we might just want to resolve once the queue is empty.
          // For simplicity, if failures occur, we'll still resolve when all started nodes finish.
          // A more robust way is to track "active" nodes.
          if (completed.size === scopedNodes.length || failed.size > 0) {
            resolve();
          }
        });
    };

    for (const node of scopedNodes) {
      if ((remainingParents.get(node.id) ?? 0) === 0) {
        launch(node);
      }
    }
  });

  return { results, leafResults };

  async function runNode(node: Node) {
    const currentRun = await prisma.run.findUnique({
      where: { id: args.runId },
      select: { status: true },
    });
    if (currentRun && currentRun.status !== "running") {
      throw new Error("Run cancelled by user");
    }

    const inputs = resolveInputs(node, incoming.get(node.id) ?? [], nodeById, results);
    try {
      await args.onNodeStart(node.id, inputs);

      if (node.type === "requestInputs") {
        const output = requestInputsOutput(node);
        results[node.id] = output;
        leafResults[node.id] = { status: "success", output };
        await args.onNodeSuccess(node.id, output, inputs);
        return;
      }

      if (node.type === "response") {
        const captured = firstStringInput(inputs);
        const capturedMedia: { type: string; url: string }[] = [];

        // Collect media inputs from connected handles
        for (const [key, value] of Object.entries(inputs)) {
          if (key.startsWith("in-media-image") || key.startsWith("in-image")) {
            const urls = Array.isArray(value) ? value : [value];
            for (const u of urls) {
              if (typeof u === "string" && u.length > 0) capturedMedia.push({ type: "image", url: u });
            }
          } else if (key.startsWith("in-media-video") || key.startsWith("in-video")) {
            const urls = Array.isArray(value) ? value : [value];
            for (const u of urls) {
              if (typeof u === "string" && u.length > 0) capturedMedia.push({ type: "video", url: u });
            }
          } else if (key.startsWith("in-media-audio") || key.startsWith("in-audio")) {
            const urls = Array.isArray(value) ? value : [value];
            for (const u of urls) {
              if (typeof u === "string" && u.length > 0) capturedMedia.push({ type: "audio", url: u });
            }
          } else if (key.startsWith("in-media-file") || key.startsWith("in-file")) {
            const urls = Array.isArray(value) ? value : [value];
            for (const u of urls) {
              if (typeof u === "string" && u.length > 0) capturedMedia.push({ type: "file", url: u });
            }
          }
        }

        const output = { captured, capturedMedia: capturedMedia.length > 0 ? capturedMedia : undefined };
        results[node.id] = captured;
        leafResults[node.id] = { status: "success", output };
        await args.onNodeSuccess(node.id, output, inputs);
        return;
      }

      // Wrap leaf task execution in a 90-second timeout limit to prevent hanging forever
      const executionTimeoutMs = 90000;
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Timeout: Node execution exceeded ${executionTimeoutMs / 1000} seconds limit`));
        }, executionTimeoutMs);
      });

      const output = await Promise.race([
        runLeaf(args.runId, node, inputs),
        timeoutPromise,
      ]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      results[node.id] = output;
      leafResults[node.id] = { status: "success", output };
      await args.onNodeSuccess(node.id, output, inputs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.add(node.id);
      leafResults[node.id] = { status: "failed", error: message };
      await args.onNodeFailure(node.id, message, inputs);
    }
  }
}

function isInScope(id: string, scope: Scope) {
  if (scope.type === "full") return true;
  if (scope.type === "partial") return scope.nodeIds.includes(id);
  return scope.nodeId === id;
}

function resolveInputs(
  node: Node,
  ins: Edge[],
  nodeById: Map<string, Node>,
  results: Record<string, unknown>,
): Record<string, unknown> {
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
    const data = node.data as {
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
    const data = node.data as {
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
  source: Node,
  sourceHandle: string | null,
  results: Record<string, unknown>,
) {
  if (source.type === "requestInputs") {
    const data = source.data as {
      fields?: { id: string; label: string; value: string }[];
    };
    const fieldId = sourceHandle?.split(":")[0]?.replace(/^field-/, "");
    return data.fields?.find((field) => field.id === fieldId)?.value;
  }

  const result = results[source.id];
  const data = source.data as Record<string, unknown>;
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

function requestInputsOutput(node: Node) {
  const data = node.data as {
    fields?: { id: string; label: string; value: string }[];
  };
  return Object.fromEntries(
    (data.fields ?? []).map((field) => [field.label || field.id, field.value]),
  );
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

async function runLeaf(
  runId: string,
  node: Node,
  inputBundle: Record<string, unknown>,
): Promise<unknown> {
  const secretKey = process.env.TRIGGER_SECRET_KEY ?? "";
  const keyType = secretKey.startsWith("tr_prod_") ? "PRODUCTION" : secretKey.startsWith("tr_dev_") ? "DEVELOPMENT" : "UNKNOWN";

  if (node.type === "cropImage") {
    const data = node.data as { x: number; y: number; w: number; h: number; inputImage?: string };
    const payload = {
      inputImage: firstString(inputBundle["in-image"]) ?? data.inputImage ?? "",
      x: Number(firstScalar(inputBundle["in-x"]) ?? data.x),
      y: Number(firstScalar(inputBundle["in-y"]) ?? data.y),
      w: Number(firstScalar(inputBundle["in-w"]) ?? data.w),
      h: Number(firstScalar(inputBundle["in-h"]) ?? data.h),
    };

    if (isTriggerConfigured()) {
      console.log(`[NextFlow] Triggering crop-image task on Trigger.dev (Env: ${keyType}, Project: ${process.env.TRIGGER_PROJECT_ID})`);
      const handle = await tasks.trigger<typeof cropImageTask>("crop-image", {
        runId,
        nodeId: node.id,
        ...payload,
      });
      console.log(`[NextFlow] Triggered crop-image task. Run ID: ${handle.id}. Polling...`);
      const runResult = await runs.poll(handle.id);
      console.log(`[NextFlow] Crop-image task completed with status: ${runResult.status}`);
      if (runResult.status === "COMPLETED") {
        return runResult.output;
      }
      throw new Error(runResult.error?.message ?? `Trigger task failed with status ${runResult.status}`);
    }

    console.log(`[NextFlow] Executing crop-image task in-process`);
    return cropImageLeaf(payload);
  }

  if (node.type === "gemini") {
    const data = node.data as {
      model: string;
      prompt: string;
      systemPrompt?: string;
      images: string[];
      video?: string;
      audio?: string;
      file?: string;
      maxWords?: number;
    };
    const payload = {
      model: data.model,
      prompt: firstString(inputBundle["in-prompt"]) ?? data.prompt,
      systemPrompt: firstString(inputBundle["in-system"]) ?? data.systemPrompt,
      images: strings(inputBundle["in-image"], data.images),
      video: firstString(inputBundle["in-video"]) ?? data.video,
      audio: firstString(inputBundle["in-audio"]) ?? data.audio,
      file: firstString(inputBundle["in-file"]) ?? data.file,
      maxWords: data.maxWords,
    };

    if (isTriggerConfigured()) {
      console.log(`[NextFlow] Triggering gemini task on Trigger.dev (Env: ${keyType}, Project: ${process.env.TRIGGER_PROJECT_ID})`);
      const handle = await tasks.trigger<typeof geminiTask>("gemini", {
        runId,
        nodeId: node.id,
        ...payload,
      });
      console.log(`[NextFlow] Triggered gemini task. Run ID: ${handle.id}. Polling...`);
      const runResult = await runs.poll(handle.id);
      console.log(`[NextFlow] Gemini task completed with status: ${runResult.status}`);
      if (runResult.status === "COMPLETED") {
        return runResult.output;
      }
      throw new Error(runResult.error?.message ?? `Trigger task failed with status ${runResult.status}`);
    }

    console.log(`[NextFlow] Executing gemini task in-process`);
    return geminiLeaf(payload);
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

function isTriggerConfigured() {
  return Boolean(
      process.env.NEXTFLOW_USE_TRIGGER === "true" &&
      process.env.TRIGGER_SECRET_KEY &&
      process.env.TRIGGER_PROJECT_ID
  );
}

function formatTaskError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}
