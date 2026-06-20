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
  auth: { key: string; expires: string };
  template_id?: string;
  fields?: Record<string, string>;
}

export function signTransloadit(
  opts: { templateId?: string; fields?: Record<string, string> } = {},
): TransloaditSignature {
  const expires =
    new Date(Date.now() + 60 * 60 * 1000) // 1h
      .toISOString()
      .slice(0, 19)
      .replace("T", "Z") + "+00:00";

  if (!AUTH_KEY || !AUTH_SECRET) {
    // Offline fallback — caller will use a data URL instead.
    return {
      auth: { key: "offline", expires },
      template_id: opts.templateId,
      fields: opts.fields,
    };
  }

  const paramsJson = JSON.stringify({
    auth: { key: AUTH_KEY, expires },
    template_id: opts.templateId,
    fields: opts.fields ?? {},
  });

  const signature = createHmac("sha1", AUTH_SECRET)
    .update(paramsJson)
    .digest("hex");

  return {
    auth: { key: AUTH_KEY, expires },
    template_id: opts.templateId,
    fields: opts.fields,
    // signature is returned separately; see /api/upload
    ...({ signature } as object),
  };
}

export function isTransloaditConfigured(): boolean {
  return Boolean(AUTH_KEY && AUTH_SECRET);
}
