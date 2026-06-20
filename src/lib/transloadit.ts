/**
 * Server-side Transloadit signature helper. NEVER expose the secret to the
 * client — sign here and return params for direct tus upload.
 *
 * If credentials are missing, we return a no-op signature and let the upload
 * route fall back to a base64 data URL. This keeps the demo runnable
 * offline while still being safe.
 */
import { createHmac } from "node:crypto";

const AUTH_KEY = process.env.TRANSLOADIT_AUTH_KEY ?? "";
const AUTH_SECRET = process.env.TRANSLOADIT_AUTH_SECRET ?? "";

export interface TransloaditSignature {
  params: string;
  signature: string;
}

export function signTransloadit(
  opts: { templateId?: string; fields?: Record<string, string> } = {},
): TransloaditSignature {
  const d = new Date(Date.now() + 60 * 60 * 1000); // 1h from now
  const pad = (n: number) => String(n).padStart(2, "0");
  const expires = `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`;

  const paramsJson = JSON.stringify({
    auth: { key: AUTH_KEY, expires },
    template_id: opts.templateId,
    fields: opts.fields ?? {},
  });

  const signature = createHmac("sha1", AUTH_SECRET)
    .update(paramsJson)
    .digest("hex");

  return {
    params: paramsJson,
    signature,
  };
}

export function isTransloaditConfigured(): boolean {
  return Boolean(AUTH_KEY && AUTH_SECRET);
}
