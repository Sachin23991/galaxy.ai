/**
 * Port type system.
 *
 * Every React Flow handle id encodes its type as `"<portName>:<PortType>"`.
 * Connection validity is decided by `isCompatible`. Invalid drags are rejected
 * by React Flow and never produce an edge in the store.
 */

export type PortType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "number"
  | "any";

export const PORT_COLORS: Record<PortType, string> = {
  text: "#a78bfa", // violet-400
  image: "#22d3ee", // cyan-400
  video: "#f472b6", // pink-400
  audio: "#facc15", // yellow-400
  file: "#94a3b8", // slate-400
  number: "#34d399", // emerald-400
  any: "#ffffff",
};

export function splitPort(handleId: string | null | undefined): PortType {
  if (!handleId) return "any";
  const idx = handleId.lastIndexOf(":");
  if (idx === -1) return "any";
  const tail = handleId.slice(idx + 1) as PortType;
  return tail in PORT_COLORS ? tail : "any";
}

export function isCompatible(
  source: PortType,
  target: PortType,
): boolean {
  if (source === "any" || target === "any") return true;
  return source === target;
}

/** Type of every field a Request-Inputs node can produce. */
export type FieldType = "text" | "image";

export interface RequestField {
  id: string;
  type: FieldType;
  label: string;
  value: string; // for text: text. for image: URL.
}

export type NodeKind =
  | "requestInputs"
  | "cropImage"
  | "gemini"
  | "response";

/** Discriminated union for node data payloads. */
export type NodeData =
  | {
      kind: "requestInputs";
      fields: RequestField[];
    }
  | {
      kind: "cropImage";
      x: number;
      y: number;
      w: number;
      h: number;
      inputImage?: string;
      outputImage?: string;
    }
  | {
      kind: "gemini";
      model: string;
      prompt: string;
      systemPrompt?: string;
      images: string[];
      video?: string;
      audio?: string;
      file?: string;
      result?: string;
      settingsOpen: boolean;
      maxWords?: number;
      showVideo?: boolean;
      showAudio?: boolean;
      showFile?: boolean;
    }
  | {
      kind: "response";
      captured?: string;
      capturedMedia?: { type: string; url: string }[];
    };
