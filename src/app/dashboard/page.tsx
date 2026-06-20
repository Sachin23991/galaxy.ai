import { Suspense } from "react";
import { DashboardClient } from "./_components/DashboardClient";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const workflows = await prisma.workflow.findMany({
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

  const initialWorkflows = workflows.map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    updatedAt: workflow.updatedAt.toISOString(),
    running: workflow.runs.length > 0,
  }));

  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">Loading...</div>}>
      <DashboardClient initialWorkflows={initialWorkflows} />
    </Suspense>
  );
}
