import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { CreateWorkflowRequestSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rows = await prisma.workflow.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
          where: { status: "running" },
        },
      },
    });
    return NextResponse.json({
      workflows: rows.map((w) => ({
        id: w.id,
        name: w.name,
        updatedAt: w.updatedAt,
        running: w.runs.length > 0,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/workflows]", msg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = CreateWorkflowRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const name = parsed.data.name ?? "Untitled workflow";
    const workflow = await prisma.workflow.create({
      data: {
        ownerId: user.id,
        name,
        nodesJson: "[]",
        edgesJson: "[]",
      },
    });
    return NextResponse.json({ workflow: { id: workflow.id, name: workflow.name } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/workflows]", msg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
