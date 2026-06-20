/**
 * Re-export the live Trigger.dev v3 tasks so `npx trigger.dev dev` discovers
 * them. The Next.js app uses the in-process orchestrator for offline demo
 * friendliness; production callers should trigger `runWorkflowTask` from a
 * server action or route handler.
 */
export { cropImageTask } from "./crop-image";
export { geminiTask } from "./gemini";
export { runWorkflowTask } from "./run-workflow";
