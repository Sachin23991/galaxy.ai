import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk(.*)",
]);

const protectedProxy = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    const { userId } = await auth();
    if (!userId) {
      const url = new URL("/sign-in", req.url);
      return NextResponse.redirect(url);
    }
  }
});

function isLocalDemoAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      !process.env.CLERK_SECRET_KEY)
  );
}

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (isLocalDemoAuthEnabled()) {
    return NextResponse.next();
  }
  if (isPublic(req)) {
    return NextResponse.next();
  }
  return protectedProxy(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
