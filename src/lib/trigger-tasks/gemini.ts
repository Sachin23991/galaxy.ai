/**
 * Gemini leaf task. Calls Google Generative AI with multimodal support.
 * Falls back to a friendly mock if GEMINI_API_KEY is missing.
 *
 * IMPORTANT: The UI shows "Gemini 3.1 Pro" but we call gemini-2.5-flash
 * under the hood (free-tier compatible).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

/** The actual model sent to the Google API (free-tier). */
const ACTUAL_MODEL = "gemini-2.5-flash";

/** Default system instruction when none is supplied by the user. */
const DEFAULT_SYSTEM_INSTRUCTION =
  "You are a helpful AI assistant. When images are provided, carefully analyze their visual content and respond based on what you see. " +
  "Always ground your responses in the actual content (text or images) provided by the user. " +
  "Be concise, accurate, and helpful.";

export interface GeminiPayload {
  model: string;
  prompt: string;
  systemPrompt?: string;
  images?: string[];
  video?: string;
  audio?: string;
  file?: string;
  maxWords?: number;
}

export interface GeminiOutput {
  outputText: string;
  model: string;
}

export async function geminiLeaf(
  payload: GeminiPayload,
): Promise<GeminiOutput> {
  if (!payload.prompt) {
    throw new Error("Prompt is required for Gemini node.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Offline fallback — keeps the demo runnable without a Gemini key.
    return {
      outputText: [
        "[offline-mode] Set GEMINI_API_KEY to enable real Gemini calls.",
        "",
        `Prompt: ${payload.prompt || "(empty)"}`,
        `System: ${payload.systemPrompt ?? "(none)"}`,
        ...(payload.maxWords ? [`Max Words: ${payload.maxWords}`] : []),
        `Images: ${(payload.images ?? []).filter(Boolean).length}`,
        `Video: ${payload.video ? "1" : "0"}`,
        `Audio: ${payload.audio ? "1" : "0"}`,
        `File: ${payload.file ? "1" : "0"}`,
      ].join("\n"),
      model: payload.model,
    };
  }

  // Use the user's system prompt if provided, otherwise fall back to default
  let systemInstruction =
    payload.systemPrompt && payload.systemPrompt.trim().length > 0
      ? payload.systemPrompt
      : DEFAULT_SYSTEM_INSTRUCTION;

  if (payload.maxWords && payload.maxWords > 0) {
    systemInstruction += ` Important: Your entire response must be at most ${payload.maxWords} words.`;
  }

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: ACTUAL_MODEL,
    systemInstruction,
  });

  // Build the multimodal parts array
  const parts: Array<
    { text: string } | { inlineData: { data: string; mimeType: string } }
  > = [];

  // Add text prompt
  if (payload.prompt) {
    parts.push({ text: payload.prompt });
  }

  // Process all media URLs (images, video, audio, file)
  const mediaUrls = [
    ...(payload.images ?? []),
    payload.video,
    payload.audio,
    payload.file,
  ].filter((u): u is string => typeof u === "string" && u.length > 0);

  for (const url of mediaUrls) {
    try {
      if (url.startsWith("data:")) {
        // Handle base64 data URLs
        const match = url.match(/^data:([^;]+);base64,(.*)$/s);
        if (match && match[1] && match[2]) {
          parts.push({
            inlineData: { data: match[2], mimeType: match[1] },
          });
          console.log(`[NextFlow] Gemini: added inline data image (${match[1]}, ${match[2].length} chars)`);
        } else {
          console.warn("[NextFlow] Gemini: data URL did not match expected base64 format");
        }
        continue;
      }

      // Handle remote URLs — fetch and convert to base64
      const r = await fetch(url);
      if (!r.ok) {
        console.warn(`[NextFlow] Gemini: failed to fetch media URL ${url}: HTTP ${r.status}`);
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      const mime = r.headers.get("content-type") ?? "application/octet-stream";
      parts.push({
        inlineData: { data: buf.toString("base64"), mimeType: mime },
      });
      console.log(`[NextFlow] Gemini: added fetched media (${mime}, ${buf.length} bytes)`);
    } catch (err) {
      console.error(`[NextFlow] Gemini: error processing media URL: ${url}`, err);
    }
  }

  // If we have no parts at all, add an empty text part to avoid API errors
  if (parts.length === 0) {
    parts.push({ text: "" });
  }

  console.log(`[NextFlow] Gemini: calling ${ACTUAL_MODEL} with ${parts.length} parts (UI shows ${payload.model})`);

  const result = await model.generateContent(parts);
  const outputText = result.response.text();

  return {
    outputText,
    model: payload.model, // Return the user-facing model name
  };
}
