import { NextResponse } from "next/server";
import { signTransloadit, isTransloaditConfigured } from "@/lib/transloadit";

/**
 * Returns Transloadit signed assembly params for direct tus upload.
 * If Transloadit is not configured, returns a `fallback: true` flag and the
 * client will read the file as a base64 data URL.
 */
export async function POST() {
  if (!isTransloaditConfigured()) {
    return NextResponse.json({ fallback: true });
  }
  const { params, signature } = signTransloadit();
  return NextResponse.json({
    params,
    signature,
    tusUrl: "https://tu.transloadit.com",
  });
}
