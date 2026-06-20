import { defineConfig } from "@trigger.dev/sdk/v3";
import { aptGet } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_mcxpppcozbuvaetsrznv",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  // Trigger.dev resolves this path from the repository root. The task
  // definitions live in trigger/jobs (src/trigger is only a placeholder).
  dirs: ["./trigger/jobs"],
  build: {
    extensions: [
      // Install ffmpeg so the crop-image task can run on the cloud worker.
      aptGet({ packages: ["ffmpeg"] }),
    ],
  },
});

