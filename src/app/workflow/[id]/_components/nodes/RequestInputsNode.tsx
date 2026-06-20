"use client";
import { Handle, Position, useEdges, type NodeProps } from "@xyflow/react";
import { useMemo, useState } from "react";
import { Plus, X, FileText, Image as ImageIcon, Lock } from "lucide-react";
import type { RequestField } from "@/lib/ports";
import { useWorkflowStore, type WorkflowNode } from "@/store/useWorkflowStore";
import { useExecutionStore } from "@/store/useExecutionStore";
import { cn } from "@/lib/cn";

export function RequestInputsNode(props: NodeProps<WorkflowNode>) {
  const data = props.data as {
    kind: "requestInputs";
    fields: RequestField[];
  };
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const isRunning = useExecutionStore((s) => !!s.running[props.id]);
  const edges = useEdges();

  const connectedSourceHandles = useMemo(() => {
    // Request-Inputs fields are outputs; connected edges will target other nodes.
    return new Set(
      edges
        .filter((e) => e.source === props.id && e.sourceHandle)
        .map((e) => e.sourceHandle as string),
    );
  }, [edges, props.id]);
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);

  const updateField = (id: string, patch: Partial<RequestField>) => {
    updateNodeData(props.id, {
      kind: "requestInputs",
      fields: data.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  const addField = (type: "text" | "image") => {
    const id = `f${Math.random().toString(36).slice(2, 7)}`;
    const sameTypeCount = data.fields.filter((field) => field.type === type).length;
    const label =
      sameTypeCount === 0 ? `${type}_field` : `${type}_field_${sameTypeCount + 1}`;
    updateNodeData(props.id, {
      kind: "requestInputs",
      fields: [
        ...data.fields,
        { id, type, label, value: "" },
      ],
    });
  };

  const removeField = (id: string) => {
    updateNodeData(props.id, {
      kind: "requestInputs",
      fields: data.fields.filter((f) => f.id !== id),
    });
  };

  const uploadFile = async (fieldId: string, file: File) => {
    setUploadingFieldId(fieldId);
    try {
      // Try Transloadit signed assembly; fall back to base64.
      const sigRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!sigRes.ok) throw new Error("upload sign failed");
      const sig = await sigRes.json();

      let url = "";
      if (sig.fallback) {
        // Read as data URL fallback
        url = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.readAsDataURL(file);
        });
      } else {
        // Direct upload to Transloadit
        const fd = new FormData();
        fd.append("file", file);
        fd.append("params", sig.params);
        fd.append("signature", sig.signature);

        const up = await fetch(
          "https://upload.transloadit.com/assemblies",
          { method: "POST", body: fd },
        );
        if (!up.ok) throw new Error("transloadit upload failed");
        const out = await up.json();
        url = out?.results?.file?.[0]?.ssl_url ?? out?.ssl_url ?? "";
      }
      updateField(fieldId, { value: url });
    } catch {
      // Fallback: read as data URL
      const reader = new FileReader();
      reader.onload = () => updateField(fieldId, { value: String(reader.result ?? "") });
      reader.readAsDataURL(file);
    } finally {
      setUploadingFieldId(null);
    }
  };

  return (
    <div
      data-running={isRunning ? "true" : "false"}
      className={cn(
        "w-[320px] nf-node-card text-gray-800 overflow-hidden",
        isRunning && "nf-pulse",
      )}
    >
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/60">
        <div className="size-6 rounded bg-amber-500/10 grid place-items-center text-amber-600">
          <FileText className="size-3.5" />
        </div>
        <div className="text-sm font-semibold flex-1 text-gray-900">Request Inputs</div>
        <Lock className="size-3.5 text-gray-400" aria-label="Cannot be deleted" />
      </div>

      <div className="p-3.5 space-y-3">
        {data.fields.map((field) => (
          <div
            key={field.id}
            className="relative rounded-lg border border-gray-150 bg-gray-50/30 p-2.5 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              {(() => {
                const handleId = `field-${field.id}:${field.type}`;
                const connected = connectedSourceHandles.has(handleId);

                return (
                  <input
                    value={field.label}
                    disabled={connected}
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                    className={cn(
                      "min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-xs font-semibold text-gray-700 outline-none focus:bg-white focus:ring-1 focus:ring-amber-500",
                      connected && "opacity-50 cursor-not-allowed",
                    )}
                  />
                );
              })()}
              <span className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide",
                field.type === "image" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
              )}>
                {field.type.toUpperCase()}
              </span>
              {data.fields.length > 1 && (
                <button
                  onClick={() => removeField(field.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove field"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            {field.type === "text" ? (
              (() => {
                const handleId = `field-${field.id}:${field.type}`;
                const connected = connectedSourceHandles.has(handleId);

                return (
                  <textarea
                    value={field.value}
                    disabled={connected}
                    onChange={(e) => updateField(field.id, { value: e.target.value })}
                    rows={2}
                    className={cn(
                      "nf-input resize-none bg-white",
                      connected && "opacity-50 cursor-not-allowed bg-gray-50",
                    )}
                    placeholder="Enter text…"
                  />
                );
              })()
            ) : (
              <div className="space-y-1.5">
                {(() => {
                  const handleId = `field-${field.id}:${field.type}`;
                  const connected = connectedSourceHandles.has(handleId);

                  return (
                    <>
                      <label
                        className={cn(
                          "flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-md py-2 text-xs text-gray-500 bg-white hover:border-blue-500 hover:text-blue-600 cursor-pointer transition-colors",
                          connected && "opacity-50 cursor-not-allowed bg-gray-50",
                        )}
                        title={connected ? "Manual input disabled while connected" : undefined}
                      >
                        <ImageIcon className="size-3.5 text-blue-500" />
                        {uploadingFieldId === field.id
                          ? "Uploading…"
                          : connected
                            ? "Connected"
                            : field.value
                              ? "Replace"
                              : "Upload image"}
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                          disabled={connected}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadFile(field.id, f);
                          }}
                        />
                      </label>
                      {field.value && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={field.value}
                          alt={field.label}
                          className="w-full h-20 object-cover rounded border border-gray-200"
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            <Handle
              id={`field-${field.id}:${field.type}`}
              type="source"
              position={Position.Right}
              className={cn(
                field.type === "image" ? "!bg-[#3b82f6]" : "!bg-[#f59e0b]",
                "!border-white"
              )}
              style={{
                top: "50%",
                right: -6,
              }}
            />
          </div>
        ))}

        <div className="flex items-center gap-1.5 pt-1">
          <button
            onClick={() => addField("text")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-2 py-1.5 text-xs text-gray-700 font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="size-3.5 text-amber-500" /> Text
          </button>
          <button
            onClick={() => addField("image")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-2 py-1.5 text-xs text-gray-700 font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="size-3.5 text-blue-500" /> Image
          </button>
        </div>
      </div>
    </div>
  );
}
