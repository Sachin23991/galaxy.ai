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
    id: "crop-1",
    type: "cropImage",
    position: { x: 400, y: 300 },
    deletable: true,
    data: {
      kind: "cropImage",
      x: 25,
      y: 25,
      w: 50,
      h: 50,
    },
  },
  {
    id: "gemini-1",
    type: "gemini",
    position: { x: 800, y: 100 },
    deletable: true,
    data: {
      kind: "gemini",
      model: "gemini-3.1-pro",
      prompt: "",
      systemPrompt: "You are an expert image analyst. Be concise.",
      images: [],
      settingsOpen: false,
      showVideo: false,
      showAudio: false,
      showFile: false,
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

export const SAMPLE_EDGES: WorkflowEdge[] = [
  {
    id: "e-req-prompt-to-gemini",
    source: "request-inputs",
    sourceHandle: "field-f1:text",
    target: "gemini-1",
    targetHandle: "in-prompt:text",
    animated: true,
    type: "purple",
  },
  {
    id: "e-req-img-to-crop",
    source: "request-inputs",
    sourceHandle: "field-f2:image",
    target: "crop-1",
    targetHandle: "in-image:image",
    animated: true,
    type: "purple",
  },
  {
    id: "e-crop-to-gemini",
    source: "crop-1",
    sourceHandle: "out-image:image",
    target: "gemini-1",
    targetHandle: "in-image:image",
    animated: true,
    type: "purple",
  },
  {
    id: "e-gemini-to-resp",
    source: "gemini-1",
    sourceHandle: "out-text:text",
    target: "response",
    targetHandle: "in-result:text",
    animated: true,
    type: "purple",
  },
];
