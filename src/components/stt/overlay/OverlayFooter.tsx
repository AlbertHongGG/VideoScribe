import React from "react";
import { motion } from "framer-motion";
import { StopCircle } from "lucide-react";
import { commands, Job } from "../../../types/bindings";

interface Props {
  currentJob: Job | null;
}

export const OverlayFooter: React.FC<Props> = ({ currentJob }) => {
  if (!currentJob) return null;
  const isTerminal = currentJob.status === 'completed' || currentJob.status === 'error' || currentJob.status === 'cancelled';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="mt-8 flex justify-center"
    >
      {isTerminal ? (
        <button 
          onClick={() => {
            commands.dismissJob();
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
