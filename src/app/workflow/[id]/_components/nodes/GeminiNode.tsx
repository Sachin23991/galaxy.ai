"use client";
import {
  Handle,
  Position,
  useEdges,
  type NodeProps,
} from "@xyflow/react";
import {
  Sparkles,
  ChevronRight,
  ChevronDown,
  Settings2,
  Trash2,
} from "lucide-react";
import type { WorkflowNode } from "@/store/useWorkflowStore";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { useExecutionStore } from "@/store/useExecutionStore";
import { cn } from "@/lib/cn";

export function GeminiNode(props: NodeProps<WorkflowNode>) {
  const data = props.data as {
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
  };
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const removeNodes = useWorkflowStore((s) => s.removeNodes);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const isRunning = useExecutionStore((s) => !!s.running[props.id]);
  const edges = useEdges();

  const connectedHandles = new Set(
    edges
      .filter((edge) => edge.target === props.id && edge.targetHandle)
      .map((edge) => edge.targetHandle as string),
  );

  const isConnected = (handleId: string) => connectedHandles.has(handleId);

  return (
    <div
      data-running={isRunning ? "true" : "false"}
      className={cn(
        "w-[360px] nf-node-card text-gray-800 overflow-hidden",
        isRunning && "nf-pulse",
      )}
    >
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 grid place-items-center text-violet-600">
            <Sparkles className="size-3.5 animate-pulse" />
          </div>
          <select
            value={data.model ?? "gemini-3.1-pro"}
            onChange={(e) =>
              updateNodeData(props.id, {
                kind: "gemini",
                model: e.target.value,
              })
            }
            className="text-sm font-semibold text-gray-900 bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 cursor-pointer pr-4 hover:text-violet-600 transition-colors"
          >
            <option value="gemini-3.1-pro" className="font-sans font-semibold">Gemini 3.1 Pro (Active)</option>
            <option value="gemini-1.5-pro" disabled className="font-sans text-gray-400">Gemini 1.5 Pro (Coming soon)</option>
            <option value="gemini-1.5-flash" disabled className="font-sans text-gray-400">Gemini 1.5 Flash (Coming soon)</option>
            <option value="gemini-2.5-flash" disabled className="font-sans text-gray-400">Gemini 2.5 Flash (Coming soon)</option>
          </select>
        </div>
        <button
          onClick={() => removeNodes([props.id])}
          className="grid size-6 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-red-500 transition-colors cursor-pointer"
          title="Delete node"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="p-3.5 space-y-3">
        {/* Info banner */}
        <div className="text-[10px] text-violet-600 font-semibold bg-violet-50/50 p-2 rounded-lg border border-violet-100/50">
          ℹ️ Gemini 3.1 Pro is available. Other models will be available in the next update.
        </div>

        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            Prompt <span className="text-red-500">*</span>
          </label>
          <div className={cn(
            "border border-dashed rounded-lg p-3 text-xs text-center transition-colors bg-white",
            isConnected("in-prompt:text")
              ? "bg-amber-50/40 border-amber-300 text-amber-600 font-semibold"
              : "text-gray-400 border-gray-300"
          )}>
            {isConnected("in-prompt:text") ? "Connected from input" : "Connect prompt handle"}
          </div>
          <Handle
            id="in-prompt:text"
            type="target"
            position={Position.Left}
            className="!bg-[#f59e0b] !border-white"
            style={{ top: "50%", left: -6 }}
          />
        </div>

        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            System prompt
          </label>
          <textarea
            value={data.systemPrompt ?? ""}
            disabled={isConnected("in-system:text")}
            onChange={(event) =>
              updateNodeData(props.id, {
                kind: "gemini",
                systemPrompt: event.target.value,
              })
            }
            rows={2}
            placeholder="Optional system instructions..."
            className={cn(
              "nf-input resize-none bg-white",
              isConnected("in-system:text") && "opacity-50 cursor-not-allowed bg-gray-50",
            )}
          />
          <Handle
            id="in-system:text"
            type="target"
            position={Position.Left}
            className="!bg-[#f59e0b] !border-white"
            style={{ top: 32, left: -6 }}
          />
        </div>

        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            Image (Vision)
          </label>
          <div className={cn(
            "border border-dashed rounded-lg p-3.5 text-xs text-center transition-colors bg-white",
            isConnected("in-image:image")
              ? "bg-blue-50/40 border-blue-300 text-blue-600 font-semibold"
              : "text-gray-400 border-gray-300"
          )}>
            {isConnected("in-image:image") ? "Connected from input" : "Connect image handle"}
          </div>
          <Handle
            id="in-image:image"
            type="target"
            position={Position.Left}
            className="!bg-[#3b82f6] !border-white"
            style={{ top: "50%", left: -6 }}
          />
        </div>

        {data.showVideo && (
          <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
              Video
            </label>
            <div className={cn(
              "border border-dashed rounded-lg p-3 text-xs text-center transition-colors bg-white",
              isConnected("in-video:video")
                ? "bg-pink-50/40 border-pink-300 text-pink-600 font-semibold"
                : "text-gray-400 border-gray-300"
            )}>
              {isConnected("in-video:video") ? "Connected from input" : "Connect video handle"}
            </div>
            <Handle
              id="in-video:video"
              type="target"
              position={Position.Left}
              className="!bg-[#f472b6] !border-white"
              style={{ top: "50%", left: -6 }}
            />
          </div>
        )}

        {data.showAudio && (
          <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
              Audio
            </label>
            <div className={cn(
              "border border-dashed rounded-lg p-3 text-xs text-center transition-colors bg-white",
              isConnected("in-audio:audio")
                ? "bg-yellow-50/40 border-yellow-300 text-yellow-600 font-semibold"
                : "text-gray-400 border-gray-300"
            )}>
              {isConnected("in-audio:audio") ? "Connected from input" : "Connect audio handle"}
            </div>
            <Handle
              id="in-audio:audio"
              type="target"
              position={Position.Left}
              className="!bg-[#facc15] !border-white"
              style={{ top: "50%", left: -6 }}
            />
          </div>
        )}

        {data.showFile && (
          <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
              File
            </label>
            <div className={cn(
              "border border-dashed rounded-lg p-3 text-xs text-center transition-colors bg-white",
              isConnected("in-file:file")
                ? "bg-slate-50/40 border-slate-300 text-slate-600 font-semibold"
                : "text-gray-400 border-gray-300"
            )}>
              {isConnected("in-file:file") ? "Connected from input" : "Connect file handle"}
            </div>
            <Handle
              id="in-file:file"
              type="target"
              position={Position.Left}
              className="!bg-[#94a3b8] !border-white"
              style={{ top: "50%", left: -6 }}
            />
          </div>
        )}

        <button
          onClick={() =>
            updateNodeData(props.id, {
              kind: "gemini",
              settingsOpen: !data.settingsOpen,
            })
          }
          className="w-full flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
        >
          {data.settingsOpen ? (
            <ChevronDown className="size-3.5 text-violet-500" />
          ) : (
            <ChevronRight className="size-3.5 text-violet-500" />
          )}
          <Settings2 className="size-3.5 text-gray-400" /> Settings
        </button>
        {data.settingsOpen && (
          <div className="space-y-3.5 rounded-lg border border-gray-200 bg-gray-50/40 p-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Temperature
                <input
                  value="0.7"
                  readOnly
                  className="mt-1 w-full rounded-md border border-gray-250 bg-white px-2 py-1 text-xs text-gray-500 cursor-not-allowed"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Max Words
                <input
                  type="number"
                  min={1}
                  value={data.maxWords ?? ""}
                  onChange={(event) =>
                    updateNodeData(props.id, {
                      kind: "gemini",
                      maxWords: event.target.value ? parseInt(event.target.value, 10) : undefined,
                    })
                  }
                  placeholder="Unlimited"
                  className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:ring-1 focus:ring-violet-500"
                />
              </label>
            </div>

            <div className="pt-2.5 border-t border-gray-200/60 space-y-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block font-semibold">
                Enable Multimodal Inputs
              </span>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer select-none font-medium">
                  <input
                    type="checkbox"
                    checked={!!data.showVideo}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateNodeData(props.id, {
                        kind: "gemini",
                        showVideo: checked,
                      });
                      if (!checked) {
                        const toRemove = edges.filter(
                          (edge) => edge.target === props.id && edge.targetHandle === "in-video:video"
                        );
                        if (toRemove.length > 0) {
                          onEdgesChange(toRemove.map((edge) => ({ id: edge.id, type: "remove" })));
                        }
                      }
                    }}
                    className="size-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span>Video Input</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer select-none font-medium">
                  <input
                    type="checkbox"
                    checked={!!data.showAudio}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateNodeData(props.id, {
                        kind: "gemini",
                        showAudio: checked,
                      });
                      if (!checked) {
                        const toRemove = edges.filter(
                          (edge) => edge.target === props.id && edge.targetHandle === "in-audio:audio"
                        );
                        if (toRemove.length > 0) {
                          onEdgesChange(toRemove.map((edge) => ({ id: edge.id, type: "remove" })));
                        }
                      }
                    }}
                    className="size-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span>Audio Input</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer select-none font-medium">
                  <input
                    type="checkbox"
                    checked={!!data.showFile}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateNodeData(props.id, {
                        kind: "gemini",
                        showFile: checked,
                      });
                      if (!checked) {
                        const toRemove = edges.filter(
                          (edge) => edge.target === props.id && edge.targetHandle === "in-file:file"
                        );
                        if (toRemove.length > 0) {
                          onEdgesChange(toRemove.map((edge) => ({ id: edge.id, type: "remove" })));
                        }
                      }
                    }}
                    className="size-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span>File Input</span>
                </label>
              </div>
            </div>
          </div>
        )}



      </div>

      <Handle
        id="out-text:text"
        type="source"
        position={Position.Right}
        className="!bg-[#f59e0b] !border-white"
        style={{ top: "50%", right: -6 }}
      />
    </div>
  );
}
