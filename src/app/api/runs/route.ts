import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { CreateRunRequestSchema } from "@/lib/schema";
import { orchestrate } from "@/lib/orchestrator";
import type { Edge, Node } from "@xyflow/react";
import { tasks } from "@trigger.dev/sdk/v3";

export const maxDuration = 60; // Vercel Hobby max; heavy work runs via Trigger.dev + after()

export async function POST(req: Request) {
  const user = await requireCurrentUser();
  const body = await req.json().catch(() => ({}));
  const parsed = CreateRunRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { workflowId, scope } = parsed.data;

  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, ownerId: user.id },
  });
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  let nodes: Node[] = [];
  let edges: Edge[] = [];
  try {
    nodes = JSON.parse(workflow.nodesJson);
  } catch {
    nodes = [];
  }
  try {
    edges = JSON.parse(workflow.edgesJson);
  } catch {
    edges = [];
  }

  const scopeString =
    scope.type === "full"
      ? "full"
      : scope.type === "partial"
        ? `partial:${scope.nodeIds.join(",")}`
        : `single:${scope.nodeId}`;

  const run = await prisma.run.create({
    data: {
      workflowId,
      status: "running",
      scope: scopeString,
    },
  });

  // Mark each in-scope node as "pending"
  const inScopeIds = new Set(
    scope.type === "full"
      ? nodes.map((n) => n.id)
      : scope.type === "partial"
        ? scope.nodeIds
        : [scope.nodeId],
  );
  if (inScopeIds.size > 0) {
    await prisma.nodeExecution.createMany({
      data: nodes
        .filter((n) => inScopeIds.has(n.id))
        .map((n) => ({
          runId: run.id,
          nodeId: n.id,
          nodeType: String(n.type ?? "unknown"),
          status: "pending",
        })),
    });
  }

  function isTriggerConfigured() {
    return Boolean(
      process.env.NEXTFLOW_USE_TRIGGER === "true" &&
      process.env.TRIGGER_SECRET_KEY &&
      process.env.TRIGGER_PROJECT_ID
    );
  }

  if (isTriggerConfigured()) {
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    await tasks.trigger("run-workflow", {
      runId: run.id,
      workflowId,
      nodes,
      edges,
      scope,
      nodePayloads: {},
      appUrl,
    });
  } else {
    // In serverless environments like Vercel, background tasks must be registered
    // via after to prevent the execution container from suspending immediately
    // after the response is returned.
    after(() => {
      void runExecution(run.id, nodes, edges, scope);
    });
  }

  return NextResponse.json({ runId: run.id });
}

async function runExecution(
  runId: string,
  nodes: Node[],
  edges: Edge[],
  scope: { type: "full" } | { type: "partial"; nodeIds: string[] } | { type: "single"; nodeId: string },
) {
  const successIds: string[] = [];
  const failedIds: string[] = [];
  const outputPatches: Record<string, Record<string, unknown>> = {};

  try {
    await orchestrate({
      runId,
      workflowId: (await prisma.run.findUnique({
        where: { id: runId },
        select: { workflowId: true },
      }))?.workflowId ?? "",
      nodes,
      edges,
      scope,
      onNodeStart: async (id, inputs) => {
        await prisma.nodeExecution.updateMany({
          where: { runId, nodeId: id },
          data: {
            status: "running",
            startedAt: new Date(),
            inputsJson: JSON.stringify(inputs ?? {}),
          },
        });
      },
      onNodeSuccess: async (id, output, inputs) => {
        successIds.push(id);
        await prisma.nodeExecution.updateMany({
          where: { runId, nodeId: id },
          data: {
            status: "success",
            inputsJson: JSON.stringify(inputs ?? {}),
            outputJson: JSON.stringify(output ?? {}),
            finishedAt: new Date(),
          },
        });
        const patch = patchForNodeOutput(id, output, nodes);
        if (patch) outputPatches[id] = patch;
      },
      onNodeFailure: async (id, err, inputs) => {
        failedIds.push(id);
        await prisma.nodeExecution.updateMany({
          where: { runId, nodeId: id },
          data: {
            status: "failed",
            inputsJson: JSON.stringify(inputs ?? {}),
            error: err,
            finishedAt: new Date(),
          },
        });
      },
    });
  } catch (err) {
    console.error("orchestrator error:", err);
  }

  const totalFailed = failedIds.length;
  const totalOk = successIds.length;
  const finalStatus =
    totalFailed === 0 ? "success" : totalOk === 0 ? "failed" : "partial";

  const updatedRun = await prisma.run.update({
    where: { id: runId },
    data: { status: finalStatus, finishedAt: new Date() },
    select: { workflowId: true },
  });

  if (Object.keys(outputPatches).length > 0) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: updatedRun.workflowId },
    });
    if (workflow) {
      let persistedNodes: Node[] = [];
      try {
        persistedNodes = JSON.parse(workflow.nodesJson);
      } catch {
        persistedNodes = nodes;
      }
      const nextNodes = persistedNodes.map((node) =>
        outputPatches[node.id]
          ? { ...node, data: { ...node.data, ...outputPatches[node.id] } }
          : node,
      );
      await prisma.workflow.update({
        where: { id: updatedRun.workflowId },
        data: { nodesJson: JSON.stringify(nextNodes) },
      });
    }
  } else {
    await prisma.workflow.update({
      where: { id: updatedRun.workflowId },
      data: { updatedAt: new Date() },
    });
  }
}

function patchForNodeOutput(
  id: string,
  output: unknown,
  currentNodes: Node[],
): Record<string, unknown> | null {
  const n = currentNodes.find((nn) => nn.id === id);
  if (!n) return null;
  const patch: Record<string, unknown> = {};
  if (n.type === "gemini") {
    const out = output as { outputText?: string } | undefined;
    if (out?.outputText) patch.result = out.outputText;
  }
  if (n.type === "cropImage") {
    const out = output as { outputImage?: string } | undefined;
    if (out?.outputImage) patch.outputImage = out.outputImage;
  }
  if (n.type === "response") {
    const out = output as { captured?: string } | undefined;
    if (out?.captured) patch.captured = out.captured;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export async function GET(req: Request) {
  const user = await requireCurrentUser();
  const url = new URL(req.url);
  const workflowId = url.searchParams.get("workflowId");
  if (!workflowId) {
    return NextResponse.json({ error: "workflowId required" }, { status: 400 });
  }
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, ownerId: user.id },
  });
  if (!workflow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const runs = await prisma.run.findMany({
    where: { workflowId },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { executions: { orderBy: { startedAt: "asc" } } },
  });
  return NextResponse.json({ runs });
}
