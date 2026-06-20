"use client";
import { getBezierPath, type EdgeProps } from "@xyflow/react";

/**
 * Color-coded animated edge. The color is chosen based on the source handle's
 * port type (text → orange, image → blue, video → green, etc.).
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

export function ColoredAnimatedEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });

  const edgeClass = edgeClassFromHandle(props.sourceHandleId);

  return (
    <>
      {/* Invisible fat path for easier click/hover targeting */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="pointer-events-auto"
      />
      {/* Visible animated edge */}
      <path
        d={path}
        className={edgeClass}
        fill="none"
        markerEnd={props.markerEnd}
      />
      {props.label ? (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#6b7280"
          fontSize={10}
          className="pointer-events-none select-none"
        >
          {String(props.label)}
        </text>
      ) : null}
    </>
  );
}
