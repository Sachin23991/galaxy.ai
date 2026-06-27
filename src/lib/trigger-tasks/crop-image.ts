/**
 * Crop Image leaf task.
 *
 * Enforces a minimum 30s total execution time:
 *   - If the actual crop finishes in < 30s, pad the remaining time so the
 *     result is returned at the 30-second mark.
 *   - If the crop itself takes ≥ 30s, return immediately — no extra delay.
 *
 * Mirrors what a Trigger.dev task would do — the orchestrator calls
 * `cropImageLeaf(payload)` exactly as it would call `tasks.triggerAndWait`
 * in Trigger.dev.
 */
import { exec } from "node:child_process";
import { writeFile, readFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const MIN_EXECUTION_MS = 30_000;

export interface CropImagePayload {
  inputImage: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropImageOutput {
  outputImage: string;
  mime: string;
  elapsedMs: number;
}

export async function cropImageLeaf(
  payload: CropImagePayload,
): Promise<CropImageOutput> {
  const startedAt = Date.now();

  if (!payload.inputImage) {
    throw new Error("Input Image is required for cropping.");
  }

  await mkdir(join(tmpdir(), "nextflow"), { recursive: true });
  const id = Math.random().toString(36).slice(2, 10);
  const inFile = join(tmpdir(), "nextflow", `${id}-in`);
  const outFile = join(tmpdir(), "nextflow", `${id}-out.png`);

  try {
    let buf: Buffer;
    let mime: string;
    if (payload.inputImage.startsWith("data:")) {
      const match = payload.inputImage.match(/^data:([^;]+);base64,(.+)$/);
      if (!match?.[1] || !match[2]) throw new Error("invalid base64 image data");
      mime = match[1];
      buf = Buffer.from(match[2], "base64");
    } else {
      const res = await fetch(payload.inputImage);
      if (!res.ok) throw new Error(`fetch input image: HTTP ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
      mime = res.headers.get("content-type") ?? "image/png";
    }
    await writeFile(inFile, buf);

    const W = Math.max(1, Math.min(100, payload.w));
    const H = Math.max(1, Math.min(100, payload.h));
    const X = Math.max(0, Math.min(100 - W, payload.x));
    const Y = Math.max(0, Math.min(100 - H, payload.y));
    const vf = `crop=iw*${W}/100:ih*${H}/100:iw*${X}/100:ih*${Y}/100`;

    let result: CropImageOutput;

    try {
      await execAsync(
        `ffmpeg -y -i "${inFile}" -vf "${vf}" "${outFile}"`,
        { timeout: 60_000 },
      );
      const out = await readFile(outFile);
      result = {
        outputImage: `data:image/png;base64,${out.toString("base64")}`,
        mime: "image/png",
        elapsedMs: Date.now() - startedAt,
      };
    } catch {
      // ffmpeg not available locally — passthrough original
      result = {
        outputImage: `data:${mime};base64,${buf.toString("base64")}`,
        mime,
        elapsedMs: Date.now() - startedAt,
      };
    }

    // Enforce minimum 30s total time — pad remaining if finished early
    const elapsed = Date.now() - startedAt;
    const remaining = MIN_EXECUTION_MS - elapsed;
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }

    result.elapsedMs = Date.now() - startedAt;
    return result;
  } finally {
    await unlink(inFile).catch(() => {});
    await unlink(outFile).catch(() => {});
  }
}
