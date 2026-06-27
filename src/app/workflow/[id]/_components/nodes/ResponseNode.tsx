"use client";
import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Inbox, Lock, Loader2, Image as ImageIcon, Film, Music, FileText } from "lucide-react";
import type { WorkflowNode } from "@/store/useWorkflowStore";
import { useExecutionStore } from "@/store/useExecutionStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { cn } from "@/lib/cn";
import { NodeTooltip } from "./NodeTooltip";

export function ResponseNode(props: NodeProps<WorkflowNode>) {
  const data = props.data as {
    kind: "response";
    captured?: string;
    capturedMedia?: { type: string; url: string }[];
  };
  const cleanedResponse = data.captured ? data.captured.replaceAll("**", "") : "";
  const isRunning = useExecutionStore((s) => !!s.running[props.id]);
  const activeRunId = useHistoryStore((s) => s.activeRunId);
  const isWorkflowRunning = activeRunId !== null;

  const [wasRunning, setWasRunning] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [prevIsWorkflowRunning, setPrevIsWorkflowRunning] = useState(isWorkflowRunning);
  const [isHovered, setIsHovered] = useState(false);

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
  const mediaItems = data.capturedMedia ?? [];

  // Handle positions — spaced vertically for each type
  const handlePositions = {
    text: "20%",
    image: "35%",
    video: "50%",
    audio: "65%",
    file: "80%",
  };

  return (
    <div
      className={cn(
        "min-w-[260px] max-w-[550px] w-fit nf-node-card text-gray-800 overflow-hidden relative",
        (isRunning || (isWorkflowRunning && !textToShow && mediaItems.length === 0)) && "nf-pulse",
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodeTooltip 
        title="Response Node"
        description="Displays the final output of the workflow."
        howItWorks="Collects text and media outputs from previous nodes and renders them here when the run is complete."
        isVisible={isHovered}
      />
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/60">
        <div className="size-6 rounded bg-fuchsia-500/10 grid place-items-center text-fuchsia-600">
          <Inbox className="size-3.5" />
        </div>
        <div className="text-sm font-semibold flex-1 text-gray-900">Response</div>
        <Lock className="size-3.5 text-gray-400" aria-label="Cannot be deleted" />
      </div>
      <div className="p-3.5 space-y-2.5">
        {/* Text result */}
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/40 p-2.5 text-xs text-gray-500 min-h-[58px] whitespace-pre-wrap break-words leading-relaxed">
          {isWorkflowRunning && !textToShow && mediaItems.length === 0 ? (
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

        {/* Media previews */}
        {mediaItems.length > 0 && (
          <div className="space-y-2">
            {mediaItems.map((item, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                {item.type === "image" && (
                  <div className="space-y-1">
                    <div className="px-2 pt-1.5 flex items-center gap-1.5 text-[10px] text-cyan-600 font-semibold">
                      <ImageIcon className="size-3" /> Image
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt="Result"
                      className="w-full max-h-[200px] object-cover"
                    />
                  </div>
                )}
                {item.type === "video" && (
                  <div className="space-y-1">
                    <div className="px-2 pt-1.5 flex items-center gap-1.5 text-[10px] text-pink-600 font-semibold">
                      <Film className="size-3" /> Video
                    </div>
                    <video
                      src={item.url}
                      controls
                      className="w-full max-h-[200px]"
                    />
                  </div>
                )}
                {item.type === "audio" && (
                  <div className="p-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-yellow-600 font-semibold">
                      <Music className="size-3" /> Audio
                    </div>
                    <audio src={item.url} controls className="w-full h-8" />
                  </div>
                )}
                {item.type === "file" && (
                  <div className="p-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold hover:text-violet-600 transition-colors"
                    >
                      <FileText className="size-3" /> Download file
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Target handles — text + 4 media types */}
      <Handle
        id="in-result:text"
        type="target"
        position={Position.Left}
        className="!bg-[#a78bfa] !border-white"
        style={{ top: handlePositions.text, left: -6 }}
        title="Text input"
      />
      <Handle
        id="in-media-image:image"
        type="target"
        position={Position.Left}
        className="!bg-[#22d3ee] !border-white"
        style={{ top: handlePositions.image, left: -6 }}
        title="Image input"
      />
      <Handle
        id="in-media-video:video"
        type="target"
        position={Position.Left}
        className="!bg-[#f472b6] !border-white"
        style={{ top: handlePositions.video, left: -6 }}
        title="Video input"
      />
      <Handle
        id="in-media-audio:audio"
        type="target"
        position={Position.Left}
        className="!bg-[#facc15] !border-white"
        style={{ top: handlePositions.audio, left: -6 }}
        title="Audio input"
      />
      <Handle
        id="in-media-file:file"
        type="target"
        position={Position.Left}
        className="!bg-[#94a3b8] !border-white"
        style={{ top: handlePositions.file, left: -6 }}
        title="File input"
      />
    </div>
  );
}
