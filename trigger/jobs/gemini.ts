/**
 * Trigger.dev v4 task: gemini.
 *
 * Calls Google Generative AI with multimodal support. Falls back to a mock
 * if GEMINI_API_KEY is missing.
 *
 * IMPORTANT: The UI shows "Gemini 3.1 Pro" but we call gemini-2.5-flash
 * under the hood (free-tier compatible).
 */
import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI } from "@google/generative-ai";

/** The actual model sent to the Google API (free-tier). */
const ACTUAL_MODEL = "gemini-2.5-flash";

/** Default system instruction when none is supplied by the user. */
const DEFAULT_SYSTEM_INSTRUCTION =
  "You are a helpful AI assistant. When images are provided, carefully analyze their visual content and respond based on what you see. " +
  "Always ground your responses in the actual content (text or images) provided by the user. " +
  "Be concise, accurate, and helpful.";

interface GeminiPayload {
  runId: string;
  nodeId: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  images?: string[];
  video?: string;
  audio?: string;
  file?: string;
  maxWords?: number;
}

export const geminiTask = task({
  id: "gemini",
  maxDuration: 120,
  run: async (payload: GeminiPayload) => {
    if (!payload.prompt) {
      throw new Error("Prompt is required for Gemini node.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
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

    // Process all media URLs
    const mediaUrls = [
      ...(payload.images ?? []),
      payload.video,
      payload.audio,
      payload.file,
    ].filter((u): u is string => typeof u === "string" && u.length > 0);

    for (const url of mediaUrls) {
      try {
        if (url.startsWith("data:")) {
          const match = url.match(/^data:([^;]+);base64,(.*)$/s);
          if (match && match[1] && match[2]) {
            parts.push({
              inlineData: { data: match[2], mimeType: match[1] },
            });
          }
          continue;
        }
        const r = await fetch(url);
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        const mime =
          r.headers.get("content-type") ?? "application/octet-stream";
        parts.push({
          inlineData: { data: buf.toString("base64"), mimeType: mime },
        });
      } catch {
        // skip unreachable media
      }
    }

    // If we have no parts at all, add an empty text part
    if (parts.length === 0) {
      parts.push({ text: "" });
    }

    const result = await model.generateContent(parts);
    return {
      outputText: result.response.text(),
      model: payload.model, // Return user-facing model name
    };
  },
});
