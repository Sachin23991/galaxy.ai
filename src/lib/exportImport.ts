/**
 * JSON export/import helpers. Validated with Zod.
 */
import { WorkflowFileSchema, type WorkflowFile } from "./schema";

export function exportWorkflowJson(
  name: string,
  nodes: unknown[],
  edges: unknown[],
): string {
  const payload: WorkflowFile = {
    format: "nextflow.v1",
    name,
    nodes: nodes as WorkflowFile["nodes"],
    edges: edges as WorkflowFile["edges"],
  };
  return JSON.stringify(payload, null, 2);
}

export function importWorkflowJson(text: string): WorkflowFile {
  const parsed = JSON.parse(text);
  return WorkflowFileSchema.parse(parsed);
}
