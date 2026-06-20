/**
 * Trigger.dev v4 project config. Used by `npx trigger.dev dev` for local
 * execution or `trigger.dev deploy` for production.
 *
 * Even though this demo runs the orchestrator in-process for offline
 * friendliness, the same leaf-task bodies are also exported as real
 * Trigger.dev tasks in `trigger/jobs/*` so they can be deployed with one
 * command.
 */
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? "proj_local",
  maxDuration: 600,
  logLevel: "info",
  runtime: "node",
  dirs: ["./trigger/jobs"],
});
