"use client";
import { useState, useEffect } from "react";
import { Handle, Position, useEdges, type NodeProps } from "@xyflow/react";
import { Scissors, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { WorkflowNode } from "@/store/useWorkflowStore";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { useExecutionStore } from "@/store/useExecutionStore";
import { cn } from "@/lib/cn";

function CropNumericInput({
  nodeId,
  field,
  value,
  disabled,
  updateNodeData,
}: {
  nodeId: string;
  field: string;
  value: number;
  disabled: boolean;
  updateNodeData: (id: string, patch: Partial<WorkflowNode["data"]>) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setDraft(val);
    if (val !== "") {
      const num = Number(val);
      updateNodeData(nodeId, {
        kind: "cropImage",
        [field]: Math.max(0, Math.min(100, num)),
      });
    } else {
      updateNodeData(nodeId, {
        kind: "cropImage",
        [field]: 0,
      });
    }
  };

  const handleBlur = () => {
    if (draft === "" || isNaN(Number(draft))) {
      setDraft("0");
      updateNodeData(nodeId, {
        kind: "cropImage",
        [field]: 0,
      });
    }
  };

  const adjustVal = (amount: number) => {
    if (disabled) return;
    const current = Number(draft) || 0;
    const next = Math.max(0, Math.min(100, current + amount));
    setDraft(String(next));
    updateNodeData(nodeId, {
      kind: "cropImage",
      [field]: next,
    });
  };

  return (
    <div className="relative w-full flex items-center">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        disabled={disabled}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          "nf-input bg-white pr-7",
          disabled && "opacity-50 cursor-not-allowed bg-gray-50",
        )}
      />
      {!disabled && (
        <div className="absolute right-1 flex flex-col items-center justify-center h-[calc(100%-2px)] top-[1px] w-5 border-l border-gray-200 bg-gray-50/50 rounded-r-lg overflow-hidden select-none">
          <button
            type="button"
            onClick={() => adjustVal(1)}
            className="w-full flex-1 flex items-center justify-center hover:bg-gray-250 active:bg-gray-300 transition-colors text-gray-500 hover:text-gray-900 border-b border-gray-200 cursor-pointer"
            title="Increase"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => adjustVal(-1)}
            className="w-full flex-1 flex items-center justify-center hover:bg-gray-250 active:bg-gray-300 transition-colors text-gray-500 hover:text-gray-900 cursor-pointer"
            title="Decrease"
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function CropImageNode(props: NodeProps<WorkflowNode>) {
  const data = props.data as {
    kind: "cropImage";
    x: number;
    y: number;
    w: number;
    h: number;
    inputImage?: string;
    outputImage?: string;
  };
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const removeNodes = useWorkflowStore((s) => s.removeNodes);
  const isRunning = useExecutionStore((s) => !!s.running[props.id]);
  const edges = useEdges();

  const connectedHandles = new Set(
    edges
      .filter((e) => e.target === props.id && e.targetHandle)
      .map((e) => e.targetHandle as string),
  );

  const imageConnected = connectedHandles.has("in-image:image");

  return (
    <div
      data-running={isRunning ? "true" : "false"}
      className={cn(
        "w-[280px] nf-node-card text-gray-800 overflow-hidden",
        isRunning && "nf-pulse",
      )}
    >
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/60">
        <div className="size-6 rounded bg-cyan-500/10 grid place-items-center text-cyan-600">
          <Scissors className="size-3.5" />
        </div>
        <div className="text-sm font-semibold flex-1 text-gray-900">Crop Image</div>
        <button
          onClick={() => removeNodes([props.id])}
          className="grid size-6 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-red-500 transition-colors cursor-pointer"
          title="Delete node"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="p-3.5 space-y-3 relative">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            Input image
          </label>
          <input
            value={data.inputImage ?? ""}
            disabled={imageConnected}
            onChange={(e) =>
              updateNodeData(props.id, {
                kind: "cropImage",
                inputImage: e.target.value,
              })
            }
            placeholder="https://…"
            className={cn(
              "nf-input bg-white",
              imageConnected && "opacity-50 cursor-not-allowed bg-gray-50",
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["x", "in-x:number", "X %"],
              ["y", "in-y:number", "Y %"],
              ["w", "in-w:number", "Width %"],
              ["h", "in-h:number", "Height %"],
            ] as const
          ).map(([key, handleId, label]) => {
            const v = (data as unknown as Record<string, number>)[key] ?? 0;
            const connected = connectedHandles.has(handleId);
            return (
              <div key={key} className="relative">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  {label}
                </label>
                <CropNumericInput
                  nodeId={props.id}
                  field={key}
                  value={v}
                  disabled={connected}
                  updateNodeData={updateNodeData}
                />
                <Handle
                  id={handleId}
                  type="target"
                  position={Position.Left}
                  className="!bg-[#10b981] !border-white"
                  style={{ top: 28, left: -6 }}
                />
              </div>
            );
          })}
        </div>

        {data.outputImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.outputImage}
            alt="cropped"
            className="w-full h-24 object-cover rounded border border-gray-250 mt-1.5"
          />
        )}
      </div>

      <Handle
        id="in-image:image"
        type="target"
        position={Position.Left}
        className="!bg-[#3b82f6] !border-white"
        style={{ top: 38, left: -6 }}
      />
      <Handle
        id="out-image:image"
        type="source"
        position={Position.Right}
        className="!bg-[#3b82f6] !border-white"
        style={{ top: "50%", right: -6 }}
      />
    </div>
  );
}
