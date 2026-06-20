import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { UpdateWorkflowRequestSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const user = await requireCurrentUser();
  const w = await prisma.workflow.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    workflow: {
      id: w.id,
      name: w.name,
      nodesJson: w.nodesJson,
      edgesJson: w.edgesJson,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    },
  });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const user = await requireCurrentUser();
  const body = await req.json().catch(() => ({}));
  const parsed = UpdateWorkflowRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const existing = await prisma.workflow.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.workflow.update({
    where: { id },
    data: {
      name: parsed.data.name ?? existing.name,
      nodesJson: parsed.data.nodesJson ?? existing.nodesJson,
      edgesJson: parsed.data.edgesJson ?? existing.edgesJson,
    },
  });
  return NextResponse.json({
    workflow: {
      id: updated.id,
      name: updated.name,
      updatedAt: updated.updatedAt,
    },
  });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const user = await requireCurrentUser();
  const existing = await prisma.workflow.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.workflow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
