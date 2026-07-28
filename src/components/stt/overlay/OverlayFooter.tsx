import React from "react";
import { motion } from "framer-motion";
import { StopCircle } from "lucide-react";
import { PipelineTask, commands } from "../../../types/bindings";
import { useSTTJobStore } from "../../../store/sttJobStore";

interface Props {
  tasks: PipelineTask[];
}

export const OverlayFooter: React.FC<Props> = ({ tasks }) => {
  const isTerminal = tasks.every(t => ['completed', 'error', 'cancelled'].includes(t.status));
  const showTerminalFooter = isTerminal;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="mt-8 flex justify-center"
    >
      {showTerminalFooter ? (
        <button 
          onClick={() => {
            useSTTJobStore.getState().setOverlayVisible(false);
          }}
          className="px-8 py-3 rounded-full bg-white/10 hover:bg-white/15 transition-colors border border-white/20 text-xs font-bold tracking-widest text-white uppercase shadow-lg shadow-black/20"
        >
          Dismiss
        </button>
      ) : (
        <button
          onClick={() => commands.cancelPipeline()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 text-white/50 hover:text-red-400 transition-all duration-300"
        >
          <StopCircle size={18} />
          <span className="text-sm font-medium">Cancel Process</span>
        </button>
      )}
    </motion.div>
  );
};
