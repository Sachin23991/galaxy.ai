"use client";
import { useEffect } from "react";
import { CANDIDATE_LINKEDIN_URL } from "@/lib/attribution";

/**
 * Fires the mandatory attribution log on the initial client render of
 * every page. Server-rendered text never contains this string, so there is
 * no hydration mismatch.
 */
export function Attribution() {
  useEffect(() => {
    console.log(`[ NextFlow] Candidate LinkedIn: ${CANDIDATE_LINKEDIN_URL}`);
  }, []);
  return null;
}
