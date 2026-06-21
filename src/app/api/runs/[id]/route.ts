import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCurrentUser } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const run = await prisma.run.findUnique({
      where: { id },
      include: {
        workflow: true,
        executions: { orderBy: { startedAt: "asc" } },
      },
    });
    if (!run || run.workflow.ownerId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Self-healing timeout check: if a run has been running for > 5 minutes (300,000 ms), auto-fail it
    if (run.status === "running") {
      const elapsed = Date.now() - new Date(run.startedAt).getTime();
      if (elapsed > 300000) {
        await prisma.run.update({
          where: { id },
          data: {
            status: "failed",
            finishedAt: new Date(),
          },
        });
        await prisma.nodeExecution.updateMany({
          where: {
            runId: id,
            status: { in: ["pending", "running"] },
          },
          data: {
            status: "failed",
            error: "Timeout: Execution exceeded 5 minutes limit",
            finishedAt: new Date(),
          },
        });
        const updatedRun = await prisma.run.findUnique({
          where: { id },
          include: {
            workflow: true,
            executions: { orderBy: { startedAt: "asc" } },
          },
        });
        return NextResponse.json({ run: updatedRun });
      }
    }

    return NextResponse.json({ run });
  } catch (err) {
    console.error("[GET /api/runs/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const run = await prisma.run.findUnique({
      where: { id },
      include: { workflow: true },
    });
    if (!run || run.workflow.ownerId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Update run status to failed and record finishing time
    await prisma.run.update({
      where: { id },
      data: {
        status: "failed",
        finishedAt: new Date(),
      },
    });

    // Mark all pending or running node executions as failed/cancelled
    await prisma.nodeExecution.updateMany({
      where: {
        runId: id,
        status: { in: ["pending", "running"] },
      },
      data: {
        status: "failed",
        error: "Cancelled by user",
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/runs/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
