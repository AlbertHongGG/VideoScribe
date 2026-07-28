import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, CircleDashed, Loader2, XCircle, StopCircle, Search } from "lucide-react";
import { PipelineTask } from "../../../types/bindings";
import { TASK_LABELS } from "./constants";

interface Props {
  task: PipelineTask;
  index: number;
  firstIncompleteIndex: number;
}

export const TaskCard: React.FC<Props> = ({ task, index, firstIncompleteIndex }) => {
  const [isErrorExpanded, setIsErrorExpanded] = useState(true);
  const isCompleted = task.status === "completed";
  const isTaskError = task.status === "error";
  const isTaskCancelled = task.status === "cancelled" || task.status === "outdated";

  const isCurrentTurn = index === firstIncompleteIndex;
  const isRunning = task.status === "running";
  const isActive = isRunning && (isCurrentTurn || (task.progress !== null && task.progress > 0));

  const label = TASK_LABELS[task.task_type as string] || task.task_type;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1],
        layout: { type: "spring", stiffness: 300, damping: 30 }
      }}
      className={`flex flex-col p-4 rounded-2xl border ${isActive
          ? "bg-white/[0.04] border-[#facc15]/30 shadow-[0_8px_32px_rgba(250,204,21,0.08)]"
          : isCompleted
            ? "bg-white/[0.015] border-green-500/15"
            : isTaskError
              ? "bg-red-500/5 border-red-500/20"
              : isTaskCancelled
                ? "bg-white/5 border-white/10 opacity-50 grayscale"
                : "bg-transparent border-white/5 opacity-60"
        }`}
    >
      <motion.div layout className="flex items-center gap-4">
        <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-500 ${isCompleted ? "text-green-400 bg-green-400/10 shadow-[0_0_12px_rgba(74,222,128,0.2)]" :
            isTaskError ? "text-red-400 bg-red-400/10 shadow-[0_0_12px_rgba(248,113,113,0.2)]" :
            isTaskCancelled ? "text-gray-400 bg-gray-400/10" :
              isActive ? "text-[#facc15] bg-[#facc15]/10 shadow-[0_0_12px_rgba(250,204,21,0.3)]" :
                "text-white/30 bg-white/5"
          }`}>
          {isCompleted ? <CheckCircle size={18} /> :
            isTaskError ? <XCircle size={18} /> :
            isTaskCancelled ? <StopCircle size={18} /> :
              isActive ? <Loader2 size={18} className="animate-spin" /> :
                <CircleDashed size={18} />}
        </div>

        <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
          <span className={`text-sm font-medium truncate transition-colors duration-500 ${isActive ? "text-white" : isCompleted ? "text-white/80" : "text-white/50"
            }`}>
            {label}
          </span>

          <AnimatePresence>
            {isActive && task.progress !== null && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-xs text-[#facc15]/90 font-mono tracking-wider"
              >
                {Math.round(task.progress)}%
              </motion.span>
            )}
            
            {/* Elegant Drill-down button for errors instead of giant block */}
            {isTaskError && task.error_message && (
               <motion.button
                 initial={{ opacity: 0, scale: 0.8 }}
                 animate={{ opacity: 1, scale: 1 }}
                 onClick={() => setIsErrorExpanded(!isErrorExpanded)}
                 className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                   isErrorExpanded 
                     ? "bg-red-500/20 text-red-300" 
                     : "bg-red-500/10 hover:bg-red-500/20 text-red-400"
                 }`}
               >
                 <Search size={14} />
               </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 12 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden relative">
              <motion.div
                className="absolute left-0 top-0 bottom-0 bg-[#facc15] shadow-[0_0_12px_rgba(250,204,21,0.6)]"
                initial={{ width: 0 }}
                animate={{ width: `${task.progress || 0}%` }}
                transition={{ type: "spring", stiffness: 40, damping: 15 }}
              />
            </div>
          </motion.div>
        )}
        
        {isTaskError && task.error_message && isErrorExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 12 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-black/30 rounded-lg border border-red-500/10">
              <div className="font-mono text-[11px] text-red-300/80 whitespace-pre-wrap break-words leading-relaxed selection:bg-red-500/30 max-h-60 overflow-y-auto custom-scrollbar">
                {task.error_message}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
