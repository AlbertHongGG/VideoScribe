import React from "react";
import { ChevronLeft, AlertCircle, TerminalSquare } from "lucide-react";
import { PipelineTask } from "../../../types/bindings";
import { TASK_LABELS } from "./constants";

interface Props {
  task: PipelineTask;
  onBack: () => void;
}

export const ErrorDetailsView: React.FC<Props> = ({ task, onBack }) => {
  return (
    <div className="w-full bg-red-500/5 border border-red-500/20 rounded-3xl shadow-[0_16px_64px_rgba(239,68,68,0.1)] overflow-hidden flex flex-col relative ring-1 ring-red-500/10">
      
      {/* Decorative Top Glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent opacity-80" />
      
      <div className="flex-shrink-0 p-5 border-b border-red-500/10 flex items-start gap-4 bg-gradient-to-b from-red-500/10 to-transparent">
        <button
          onClick={onBack}
          className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 hover:text-red-300 transition-all hover:scale-105 active:scale-95"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} className="text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
            <h3 className="text-red-100 font-medium text-sm tracking-wide">Error Details</h3>
          </div>
          <p className="text-red-400/60 text-xs truncate">
            {TASK_LABELS[task.task_type as string] || task.task_type}
          </p>
        </div>
      </div>
      
      <div className="p-5 bg-black/40">
        <div className="flex items-center gap-2 mb-4 text-red-400/50">
          <TerminalSquare size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Stack Trace</span>
        </div>
        <div className="font-mono text-xs text-red-300/90 whitespace-pre-wrap break-words leading-relaxed selection:bg-red-500/30 max-h-96 overflow-y-auto custom-scrollbar pr-2">
          {task.error_message || "Unknown Error"}
        </div>
      </div>

    </div>
  );
};
