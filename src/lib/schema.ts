/**
 * Zod schemas used at API boundaries (and for export/import).
 */
import { z } from "zod";

export const RequestFieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["text", "image"]),
  label: z.string().min(1),
  value: z.string().default(""),
});

export const NodeDataSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("requestInputs"),
    fields: z.array(RequestFieldSchema),
  }),
  z.object({
    kind: z.literal("cropImage"),
    x: z.number().min(0).max(100).default(0),
    y: z.number().min(0).max(100).default(0),
    w: z.number().min(1).max(100).default(100),
    h: z.number().min(1).max(100).default(100),
    inputImage: z.string().optional(),
    outputImage: z.string().optional(),
  }),
  z.object({
    kind: z.literal("gemini"),
    model: z.string().min(1),
    prompt: z.string().default(""),
    systemPrompt: z.string().optional(),
    images: z.array(z.string()).default([]),
    video: z.string().optional(),
    audio: z.string().optional(),
    file: z.string().optional(),
    result: z.string().optional(),
    settingsOpen: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("response"),
    captured: z.string().optional(),
  }),
]);

export const ReactFlowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.any()),
  deletable: z.boolean().optional(),
});

export const ReactFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  type: z.string().optional(),
});

export const WorkflowFileSchema = z.object({
  format: z.literal("nextflow.v1"),
  name: z.string().min(1).max(120),
  nodes: z.array(ReactFlowNodeSchema),
  edges: z.array(ReactFlowEdgeSchema),
});

export type WorkflowFile = z.infer<typeof WorkflowFileSchema>;

export const CreateWorkflowRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

export const UpdateWorkflowRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  nodesJson: z.string().optional(),
  edgesJson: z.string().optional(),
});

export const CreateRunRequestSchema = z.object({
  workflowId: z.string().min(1),
  scope: z.union([
    z.object({ type: z.literal("full") }),
    z.object({ type: z.literal("partial"), nodeIds: z.array(z.string()) }),
    z.object({ type: z.literal("single"), nodeId: z.string() }),
  ]),
});

export const TransloaditSignatureRequestSchema = z.object({
  templateId: z.string().min(1).optional(),
  fields: z.record(z.string(), z.string()).optional(),
});
