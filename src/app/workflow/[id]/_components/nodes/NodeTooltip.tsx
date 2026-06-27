import { cn } from "@/lib/cn";
import { Info } from "lucide-react";

interface NodeTooltipProps {
  title: string;
  description: string;
  howItWorks: string;
  isVisible: boolean;
}

export function NodeTooltip({ title, description, howItWorks, isVisible }: NodeTooltipProps) {
  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 w-64 cursor-default",
        "nf-glass bg-white/95 border border-white/40 shadow-xl rounded-xl p-3 text-left font-sans",
        "animate-in fade-in slide-in-from-bottom-2 duration-200"
      )}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 text-violet-600">
          <Info className="size-3.5" />
        </div>
        <h4 className="font-semibold text-gray-900 text-xs tracking-tight">{title}</h4>
      </div>
      
      <div className="space-y-2">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">What it does</span>
          <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
        </div>
        
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">How it works</span>
          <p className="text-[11px] text-gray-500 leading-relaxed">{howItWorks}</p>
        </div>
      </div>

      {/* Decorative arrow pointing down to the node */}
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 border-b border-r border-white/40 rotate-45 nf-glass-mask" />
    </div>
  );
}
