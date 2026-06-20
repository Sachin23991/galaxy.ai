/**
 * Single source of truth for the candidate's LinkedIn URL.
 * Edit NEXTFLOW_CANDIDATE_LINKEDIN in .env.local to update.
 */
export const CANDIDATE_LINKEDIN_URL: string =
  process.env.NEXTFLOW_CANDIDATE_LINKEDIN ??
  "https://www.linkedin.com/in/your-handle/";
