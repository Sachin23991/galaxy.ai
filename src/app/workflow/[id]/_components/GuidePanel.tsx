"use client";
import { useState } from "react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { HelpCircle, ChevronLeft, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function GuidePanel() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const runs = useHistoryStore((s) => s.runs);
  const [collapsed, setCollapsed] = useState(false);

  const reqNode = nodes.find((n) => n.type === "requestInputs");
  const hasFields = Boolean(reqNode && (reqNode.data as { fields?: unknown[] })?.fields && ((reqNode.data as { fields: unknown[] }).fields.length ?? 0) > 0);
  
  // Step 2: Has middle nodes
  const hasMiddleNode = nodes.some((n) => n.type === "cropImage" || n.type === "gemini");

  // Step 3: Has connections
  const hasConnections = edges.length > 0;

  // Step 4: Connected to Response
  const connectedToResponse = edges.some((e) => e.target === "response");

  // Step 5: Has run
  const hasRun = runs.length > 0 && runs[0]?.status === "success";

  const steps = [
    {
      id: 1,
      title: "Add Input Fields",
      desc: "Configure text inputs or image uploads in your starting 'Request Inputs' node.",
      done: hasFields,
    },
    {
      id: 2,
      title: "Place Middle Nodes",
      desc: "Click '+' in the bottom center bar to add 'Crop Image' or 'Gemini 3.1 Pro'.",
      done: hasMiddleNode,
    },
    {
      id: 3,
      title: "Connect Your Ports",
      desc: "Drag lines from source output handles (Right) to target input handles (Left).",
      done: hasConnections,
    },
    {
      id: 4,
      title: "Route to Response",
      desc: "Connect the output of your GPT or Image node to the 'Response' node target handle.",
      done: connectedToResponse,
    },
    {
      id: 5,
      title: "Execute Workflow",
      desc: "Click 'Play' in the header to run your pipeline. Make sure you have balance credits!",
      done: hasRun,
    },
  ];

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed top-24 left-4 z-40 nf-glass size-10 rounded-full grid place-items-center text-gray-500 hover:text-gray-900 transition-colors pointer-events-auto cursor-pointer shadow-md"
        title="Show step-by-step builder guide"
      >
        <HelpCircle className="size-5 text-violet-600 animate-pulse" />
      </button>
    );
  }

  return (
    <div className="fixed top-24 left-4 z-40 nf-glass w-[300px] rounded-2xl p-4 flex flex-col pointer-events-auto shadow-xl border border-gray-250/80 animate-in slide-in-from-left duration-200 font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-4.5 text-violet-600" />
          <h3 className="text-sm font-bold text-gray-900">Builder Steps</h3>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
          title="Minimize Guide"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      <div className="mt-3.5 space-y-4 overflow-y-auto max-h-[400px]">
        {steps.map((step) => (
          <div key={step.id} className="flex gap-2.5">
            <div className="mt-0.5">
              {step.done ? (
                <CheckCircle2 className="size-4.5 text-emerald-500 shrink-0" />
              ) : (
                <div className="size-4.5 rounded-full border-2 border-gray-300 text-gray-400 text-[10px] font-bold grid place-items-center shrink-0">
                  {step.id}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={cn(
                "text-xs font-bold transition-colors",
                step.done ? "text-gray-400 line-through font-medium" : "text-gray-800"
              )}>
                {step.title}
              </h4>
              <p className={cn(
                "text-[10px] leading-relaxed mt-0.5 transition-colors",
                step.done ? "text-gray-350" : "text-gray-500"
              )}>
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
