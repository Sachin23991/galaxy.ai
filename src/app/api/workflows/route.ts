import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { CreateWorkflowRequestSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireCurrentUser();
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
}

export async function POST(req: Request) {
  const user = await requireCurrentUser();
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
}
