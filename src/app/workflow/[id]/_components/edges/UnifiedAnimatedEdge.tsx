"use client";

import { useMemo, useState } from "react";
import { getBezierPath, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { cn } from "@/lib/cn";

/**
 * Unified animated edge:
 * - Port-type coloring (text/image/video/audio/file)
 * - Premium CSS dash animation + hover glow (handled in globals.css)
 * - Hover delete affordance for connections
 */

const PORT_EDGE_CLASS: Record<string, string> = {
  text: "nf-edge-text",
  image: "nf-edge-image",
  video: "nf-edge-video",
  audio: "nf-edge-audio",
  file: "nf-edge-file",
};

function edgeClassFromHandle(handle: string | undefined | null): string {
  if (!handle) return "nf-edge";
  const idx = handle.lastIndexOf(":");
  if (idx === -1) return "nf-edge";
  const portType = handle.slice(idx + 1);
  return PORT_EDGE_CLASS[portType] ?? "nf-edge";
}

export function UnifiedAnimatedEdge(props: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);

  const [path, labelX, labelY] = useMemo(
    () =>
      getBezierPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
        sourcePosition: props.sourcePosition,
        targetPosition: props.targetPosition,
      }),
    [
      props.sourceX,
      props.sourceY,
      props.targetX,
      props.targetY,
      props.sourcePosition,
      props.targetPosition,
    ],
  );

  const edgeClass = edgeClassFromHandle(props.sourceHandleId);

  return (
    <>
      {/* Invisible fat path for interaction/hover targeting */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="cursor-pointer pointer-events-auto"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Visible animated edge */}
      <path
        d={path}
        className={cn(edgeClass, isHovered ? "nf-edge-hover" : "")}
        fill="none"
        markerEnd={props.markerEnd}
      />

      {/* Optional label */}
      {props.label ? (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#a1a1aa"
          fontSize={10}
          className="pointer-events-none select-none"
        >
          {String(props.label)}
        </text>
      ) : null}

      {/* Delete button (hover/selected) */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdgesChange([{ id: props.id, type: "remove" }]);
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
              "size-5 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all duration-200 cursor-pointer",
              isHovered || props.selected
                ? "opacity-100 scale-110"
                : "opacity-0 scale-75 pointer-events-none",
            )}
            title="Delete connection"
          >
            <X className="size-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

