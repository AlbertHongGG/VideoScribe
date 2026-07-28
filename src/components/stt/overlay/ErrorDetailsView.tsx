import React from "react";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { PipelineTask } from "../../../types/bindings";
import { TASK_LABELS } from "./constants";

interface Props {
  task: PipelineTask;
  onBack: () => void;
}

export const ErrorDetailsView: React.FC<Props> = ({ task, onBack }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 bg-[#0a0a0a]/98 backdrop-blur-xl z-20 flex flex-col h-full"
    >
      <div className="flex-shrink-0 p-4 border-b border-white/10 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h3 className="text-white font-medium text-sm">Error Details</h3>
          <p className="text-white/40 text-xs">{TASK_LABELS[task.task_type as string] || task.task_type}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#0f0f0f]">
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 font-mono text-xs text-red-400/90 whitespace-pre-wrap break-words">
          {task.error_message || "Unknown Error"}
        </div>
      </div>
    </motion.div>
  );
};
