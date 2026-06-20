"use client";
import { useState, useMemo, useEffect } from "react";
import { Plus, Search, Clock, Crop, Sparkles } from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import type { NodeKind } from "@/lib/ports";
import { cn } from "@/lib/cn";

interface PickerEntry {
  type: NodeKind | null;
  label: string;
  description: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

const ENTRIES: PickerEntry[] = [
  {
    type: "cropImage",
    label: "Crop Image",
    description: "Crop an image to a rectangle",
    category: "Image",
    icon: Crop,
    enabled: true,
  },
  {
    type: null,
    label: "Resize Image",
    description: "Coming soon",
    category: "Image",
    icon: Crop,
    enabled: false,
  },
  {
    type: "gemini",
    label: "Gemini 3.1 Pro",
    description: "Google Gemini multimodal LLM",
    category: "LLM",
    icon: Sparkles,
    enabled: true,
  },
  {
    type: null,
    label: "HTTP Request",
    description: "Coming soon",
    category: "Others",
    icon: Sparkles,
    enabled: false,
  },
  {
    type: null,
    label: "Conditional",
    description: "Coming soon",
    category: "Others",
    icon: Sparkles,
    enabled: false,
  },
  {
    type: null,
    label: "Trim Video",
    description: "Coming soon",
    category: "Video",
    icon: Sparkles,
    enabled: false,
  },
  {
    type: null,
    label: "Transcribe Video",
    description: "Coming soon",
    category: "Video",
    icon: Sparkles,
    enabled: false,
  },
  {
    type: null,
    label: "Transcribe Audio",
    description: "Coming soon",
    category: "Audio",
    icon: Sparkles,
    enabled: false,
  },
  {
    type: null,
    label: "Generate Audio",
    description: "Coming soon",
    category: "Audio",
    icon: Sparkles,
    enabled: false,
  },
];

const CATEGORY_ORDER = ["Recent", "LLM", "Image", "Video", "Audio", "Others"];

interface Props {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export function NodePicker({ externalOpen, onExternalClose }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const addNode = useWorkflowStore((s) => s.addNode);
  const recent = useWorkflowStore((s) => s.recentNodeTypes);

  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);

  const handleClose = () => {
    setOpen(false);
    setQuery("");
    onExternalClose?.();
  };

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (e: PickerEntry) =>
      q.length === 0 || e.label.toLowerCase().includes(q);
    const result: Record<string, PickerEntry[]> = {};
    for (const cat of CATEGORY_ORDER) result[cat] = [];
    if (recent.length > 0) {
      for (const t of recent) {
        const e = ENTRIES.find((x) => x.type === t);
        if (e && e.enabled) result.Recent!.push(e);
      }
    }
    for (const e of ENTRIES) {
      if (!match(e)) continue;
      if (!result[e.category]) result[e.category] = [];
      result[e.category]!.push(e);
    }
    return result;
  }, [query, recent]);

  const onPick = (entry: PickerEntry) => {
    if (!entry.enabled || !entry.type) return;
    addNode(entry.type);
    handleClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={handleClose}
      />
      {/* Picker */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[440px] max-h-[500px] overflow-hidden rounded-2xl nf-glass shadow-2xl">
        {/* Search */}
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <Search className="size-4 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes…"
            className="flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none text-gray-900"
          />
        </div>

        {/* Categories */}
        <div className="overflow-y-auto max-h-[420px] py-1">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={cat} className="px-1 pb-1">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-1.5">
                  {cat === "Recent" && <Clock className="size-3" />}
                  {cat}
                </div>
                {items.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.label + cat}
                      disabled={!entry.enabled}
                      onClick={() => onPick(entry)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm rounded-xl mx-1 transition-colors",
                        entry.enabled
                          ? "hover:bg-gray-100 text-gray-900 cursor-pointer"
                          : "opacity-35 cursor-not-allowed",
                      )}
                    >
                      <div
                        className={cn(
                          "size-8 rounded-lg grid place-items-center border",
                          entry.enabled
                            ? "bg-white border-gray-200 shadow-sm"
                            : "bg-gray-50 border-gray-100"
                        )}
                      >
                        <Icon className="size-4 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium">
                          {entry.label}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {entry.description}
                        </div>
                      </div>
                      {!entry.enabled && (
                        <span className="text-[9px] uppercase tracking-wider text-gray-300 font-semibold bg-gray-100 px-2 py-0.5 rounded">
                          Soon
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
