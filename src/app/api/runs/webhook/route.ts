import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Node } from "@xyflow/react";

export async function POST(req: Request) {
  const authHeader = req.headers.get("x-trigger-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  const expectedSecret = process.env.TRIGGER_SECRET_KEY;

  if (!expectedSecret || authHeader !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, runId, nodeId, inputs, output, error, finalStatus } = body;

  if (action === "node-start") {
    await prisma.nodeExecution.updateMany({
      where: { runId, nodeId },
      data: {
        status: "running",
        startedAt: new Date(),
        inputsJson: inputs ? JSON.stringify(inputs) : null,
      },
    });
  } else if (action === "node-success") {
    await prisma.nodeExecution.updateMany({
      where: { runId, nodeId },
      data: {
        status: "success",
        outputJson: output ? JSON.stringify(output) : null,
        finishedAt: new Date(),
      },
    });

    const nodeExec = await prisma.nodeExecution.findFirst({
      where: { runId, nodeId },
      select: { run: { select: { workflowId: true } }, nodeType: true }
    });

    if (nodeExec && nodeExec.run) {
      const workflow = await prisma.workflow.findUnique({
        where: { id: nodeExec.run.workflowId }
      });
      if (workflow) {
        let nodes: Node[] = [];
        try {
          nodes = JSON.parse(workflow.nodesJson);
        } catch {
          nodes = [];
        }

        const patch: Record<string, unknown> = {};
        if (nodeExec.nodeType === "gemini") {
          const out = output as { outputText?: string } | undefined;
          if (out?.outputText) patch.result = out.outputText;
        }
        if (nodeExec.nodeType === "cropImage") {
          const out = output as { outputImage?: string } | undefined;
          if (out?.outputImage) patch.outputImage = out.outputImage;
        }
        if (nodeExec.nodeType === "response") {
          const out = output as { captured?: string } | undefined;
          if (out?.captured) patch.captured = out.captured;
        }

        if (Object.keys(patch).length > 0) {
          const nextNodes = nodes.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, ...patch } }
              : node
          );
          await prisma.workflow.update({
            where: { id: nodeExec.run.workflowId },
            data: { nodesJson: JSON.stringify(nextNodes) }
          });
        }
      }
    }
  } else if (action === "node-failure") {
    await prisma.nodeExecution.updateMany({
      where: { runId, nodeId },
      data: {
        status: "failed",
        error: error || "Node execution failed",
        finishedAt: new Date(),
      },
    });
  } else if (action === "run-finish") {
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: finalStatus || "success",
        finishedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
