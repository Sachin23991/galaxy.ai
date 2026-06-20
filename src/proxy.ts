import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk(.*)",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedProxy: any = null;

function getProxy() {
  if (!cachedProxy) {
    cachedProxy = clerkMiddleware(async (auth, req) => {
      if (!isPublic(req)) {
        const { userId } = await auth();
        if (!userId) {
          const url = new URL("/sign-in", req.url);
          return NextResponse.redirect(url);
        }
      }
    });
  }
  return cachedProxy;
}

function isLocalDemoAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      !process.env.CLERK_SECRET_KEY)
  );
}

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const hasClerkKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY;
  if (isLocalDemoAuthEnabled() || !hasClerkKeys) {
    return NextResponse.next();
  }
  if (isPublic(req)) {
    return NextResponse.next();
  }
  const handler = getProxy();
  return handler(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
