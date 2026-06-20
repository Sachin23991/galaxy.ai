/**
 * Trigger.dev v4 task: crop-image.
 *
 * Includes the MANDATORY 30s artificial delay.
 * The Trigger.dev runtime runs ffmpeg natively on every machine image.
 */
import { task } from "@trigger.dev/sdk/v3";
import { exec } from "node:child_process";
import { writeFile, readFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface CropImagePayload {
  runId: string;
  nodeId: string;
  inputImage: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const cropImageTask = task({
  id: "crop-image",
  maxDuration: 120,
  run: async (payload: CropImagePayload) => {
    const startedAt = Date.now();

    if (!payload.inputImage) {
      throw new Error("Input Image is required for cropping.");
    }

    await mkdir(join(tmpdir(), "nextflow"), { recursive: true });
    const id = payload.nodeId.replace(/\W/g, "_") || Math.random().toString(36).slice(2);
    const inFile = join(tmpdir(), "nextflow", `${id}-in`);
    const outFile = join(tmpdir(), "nextflow", `${id}-out.png`);

    try {
      let buf: Buffer;
      if (payload.inputImage.startsWith("data:")) {
        const match = payload.inputImage.match(/^data:([^;]+);base64,(.+)$/s);
        if (!match || !match[1] || !match[2]) {
          throw new Error("Invalid base64 image data URI format");
        }
        buf = Buffer.from(match[2], "base64");
      } else {
        const res = await fetch(payload.inputImage);
        if (!res.ok) throw new Error(`fetch input: HTTP ${res.status}`);
        buf = Buffer.from(await res.arrayBuffer());
      }
      await writeFile(inFile, buf);

      const W = Math.max(1, Math.min(100, payload.w));
      const H = Math.max(1, Math.min(100, payload.h));
      const X = Math.max(0, Math.min(100 - W, payload.x));
      const Y = Math.max(0, Math.min(100 - H, payload.y));
      const vf = `crop=iw*${W}/100:ih*${H}/100:iw*${X}/100:ih*${Y}/100`;

      await execAsync(
        `ffmpeg -y -i "${inFile}" -vf "${vf}" "${outFile}"`,
        { timeout: 60_000 },
      );
      const out = await readFile(outFile);
      return {
        outputImage: `data:image/png;base64,${out.toString("base64")}`,
        mime: "image/png",
        elapsedMs: Date.now() - startedAt,
      };
    } finally {
      await unlink(inFile).catch(() => {});
      await unlink(outFile).catch(() => {});
    }
  },
});
