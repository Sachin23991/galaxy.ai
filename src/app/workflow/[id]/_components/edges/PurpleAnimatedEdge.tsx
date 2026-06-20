"use client";
import { useState } from "react";
import { getBezierPath, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { cn } from "@/lib/cn";

/**
 * Animated purple edge per the spec. The actual flow animation is a CSS
 * keyframe in globals.css (.nf-edge).
 * Added custom hover state and an absolute delete button for connections.
 */
export function PurpleAnimatedEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });

  const [isHovered, setIsHovered] = useState(false);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);

  return (
    <>
      <g
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="react-flow__edge-path"
      >
        {/* Invisible thick path for easier hovering */}
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          className="cursor-pointer"
        />
        {/* Visible animated edge */}
        <path
          d={path}
          className="nf-edge"
          fill="none"
          markerEnd={props.markerEnd}
        />
      </g>

      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdgesChange([{ id: props.id, type: "remove" }]);
            }}
            className={cn(
              "size-5 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all duration-200 cursor-pointer",
              (isHovered || props.selected) ? "opacity-100 scale-110" : "opacity-0 scale-75 pointer-events-none"
            )}
            title="Delete connection"
          >
            <X className="size-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>

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
    </>
  );
}
