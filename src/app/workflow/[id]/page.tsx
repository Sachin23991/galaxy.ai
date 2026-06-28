import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { CanvasShell } from "./_components/CanvasShell";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function WorkflowPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const workflow = await prisma.workflow.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!workflow) {
    throw new Error(`Workflow lookup failed! Debug Info: id=${id}, user.id=${user.id}`);
  }

  return (
    <CanvasShell
      workflow={{
        id: workflow.id,
        name: workflow.name,
        nodesJson: workflow.nodesJson,
        edgesJson: workflow.edgesJson,
      }}
    />
  );
}
