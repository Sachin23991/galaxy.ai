/**
 * Server-side auth helpers. Resolves the current Clerk user to a local
 * Prisma User row (creating it on first login via webhook is optional; for
 * the hackathon we upsert lazily on first request).
 */
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "./db";

export async function getOrCreateCurrentUser() {
  if (isLocalDemoAuthEnabled()) {
    return prisma.user.upsert({
      where: { clerkId: "local-demo-user" },
      create: {
        clerkId: "local-demo-user",
        email: "local@nextflow.dev",
        name: "Local Demo",
      },
      update: {
        email: "local@nextflow.dev",
        name: "Local Demo",
      },
    });
  }

  const user = await currentUser().catch(() => null);
  if (!user) {
    return null;
  }
  const clerkId = user.id;
  const email = user.emailAddresses[0]?.emailAddress ?? null;
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    null;

  return prisma.user.upsert({
    where: { clerkId },
    create: { clerkId, email, name },
    update: { email, name },
  });
}

export async function requireCurrentUser() {
  const u = await getOrCreateCurrentUser();
  if (!u) throw new Error("Unauthorized");
  return u;
}

function isLocalDemoAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      !process.env.CLERK_SECRET_KEY)
  );
}
