"use client";
import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Inbox, Lock, Loader2 } from "lucide-react";
import type { WorkflowNode } from "@/store/useWorkflowStore";
import { useExecutionStore } from "@/store/useExecutionStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { cn } from "@/lib/cn";

export function ResponseNode(props: NodeProps<WorkflowNode>) {
  const data = props.data as { kind: "response"; captured?: string };
  const cleanedResponse = data.captured ? data.captured.replaceAll("**", "") : "";
  const isRunning = useExecutionStore((s) => !!s.running[props.id]);
  const activeRunId = useHistoryStore((s) => s.activeRunId);
  const isWorkflowRunning = activeRunId !== null;

  const [wasRunning, setWasRunning] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [prevIsWorkflowRunning, setPrevIsWorkflowRunning] = useState(isWorkflowRunning);

  if (isWorkflowRunning !== prevIsWorkflowRunning) {
    setPrevIsWorkflowRunning(isWorkflowRunning);
    if (isWorkflowRunning) {
      setWasRunning(true);
      setDisplayedText("");
    }
  }

  useEffect(() => {
    if (cleanedResponse && wasRunning) {
      let currentText = "";
      const words = cleanedResponse.split(" ");
      let index = 0;

      const interval = setInterval(() => {
        if (index < words.length) {
          currentText += (index === 0 ? "" : " ") + words[index];
          setDisplayedText(currentText);
          index++;
        } else {
          clearInterval(interval);
          setWasRunning(false);
        }
      }, 55);

      return () => clearInterval(interval);
    }
  }, [cleanedResponse, wasRunning]);

  const textToShow = wasRunning ? displayedText : cleanedResponse;

  return (
    <div
      className={cn(
        "min-w-[260px] max-w-[550px] w-fit nf-node-card text-gray-800 overflow-hidden",
        (isRunning || (isWorkflowRunning && !textToShow)) && "nf-pulse",
      )}
    >
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/60">
        <div className="size-6 rounded bg-fuchsia-500/10 grid place-items-center text-fuchsia-600">
          <Inbox className="size-3.5" />
        </div>
        <div className="text-sm font-semibold flex-1 text-gray-900">Response</div>
        <Lock className="size-3.5 text-gray-400" aria-label="Cannot be deleted" />
      </div>
      <div className="p-3.5">
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/40 p-2.5 text-xs text-gray-500 min-h-[58px] whitespace-pre-wrap break-words leading-relaxed">
          {isWorkflowRunning && !textToShow ? (
            <div className="flex flex-col gap-2 py-2 animate-pulse min-w-[200px]">
              <div className="flex items-center gap-2 text-violet-600 font-semibold mb-1">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Executing workflow...</span>
              </div>
              <div className="h-2 bg-gray-250/70 rounded w-11/12"></div>
              <div className="h-2 bg-gray-250/70 rounded w-5/6"></div>
              <div className="h-2 bg-gray-250/70 rounded w-2/3"></div>
            </div>
          ) : textToShow ? (
            <span className="text-gray-800 font-semibold">{textToShow}</span>
          ) : (
            <span className="grid min-h-[40px] place-items-center text-center text-gray-400">
              Final workflow result will be captured here
            </span>
          )}
        </div>
      </div>
      <Handle
        id="in-result:text"
        type="target"
        position={Position.Left}
        className="!bg-[#f59e0b] !border-white"
        style={{ top: "50%", left: -6 }}
      />
    </div>
  );
}
