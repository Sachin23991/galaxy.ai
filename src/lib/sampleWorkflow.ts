import type { WorkflowNode, WorkflowEdge } from "@/store/useWorkflowStore";

export const SAMPLE_NODES: WorkflowNode[] = [
  {
    id: "request-inputs",
    type: "requestInputs",
    position: { x: 50, y: 150 },
    deletable: false,
    data: {
      kind: "requestInputs",
      fields: [
        {
          id: "f1",
          type: "text",
          label: "Prompt",
          value: "Describe what you see in the cropped image.",
        },
        {
          id: "f2",
          type: "image",
          label: "Source Image",
          value: "https://images.unsplash.com/photo-1543373014-cfe4f4bc1cdf?q=80&w=1000&auto=format&fit=crop",
        },
      ],
    },
  },
  {
    id: "response",
    type: "response",
    position: { x: 1250, y: 150 },
    deletable: false,
    data: { kind: "response" },
  },
];

export const SAMPLE_EDGES: WorkflowEdge[] = [];
