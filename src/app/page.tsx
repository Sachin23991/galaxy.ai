import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function RootPage() {
  // Local development bypass when Clerk keys are missing
  if (
    process.env.NODE_ENV !== "production" &&
    (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      !process.env.CLERK_SECRET_KEY)
  ) {
    redirect("/dashboard");
  }

  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  redirect("/sign-in");
}
