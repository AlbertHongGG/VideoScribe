import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PipelineTask } from "../../types/bindings";
import { CheckCircle, CircleDashed, Loader2, XCircle } from "lucide-react";

interface Props {
  tasks: PipelineTask[];
}

const TASK_LABELS: Record<string, string> = {
  mss: "Separating Audio Sources",
  vad: "Detecting Voice Activity",
  stt: "Transcribing Speech",
  translation: "Translating Subtitles",
};

export const STTProcessingOverlay: React.FC<Props> = ({ tasks }) => {
  // Find the first task that is not completed and not in error.
  const firstIncompleteIndex = tasks.findIndex(t => t.status !== "completed" && t.status !== "error");

  return (
    <div className="absolute inset-0 bg-[#0a0a0a]/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 overflow-hidden">
      <div className="w-full max-w-sm">
        <div className="space-y-4">
          <AnimatePresence>
            {tasks.map((task, index) => {
              const isCompleted = task.status === "completed";
              const isError = task.status === "error";
              
              // Only consider a task actively running if it's the current step in the sequence,
              // OR if it has actually started making progress (>0%). This prevents later tasks
              // from looking active just because they were initialized in the backend.
              const isCurrentTurn = index === firstIncompleteIndex;
              const isRunning = task.status === "running";
              const isActive = isRunning && (isCurrentTurn || (task.progress !== null && task.progress > 0));
              
              return (
                <motion.div
                  key={task.task_type}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, ease: "easeOut" }}
                  className={`flex flex-col p-4 rounded-2xl border transition-all duration-500 ${
                    isActive 
                      ? "bg-white/[0.04] border-[#facc15]/30 shadow-[0_8px_32px_rgba(250,204,21,0.08)]" 
                      : isCompleted
                      ? "bg-white/[0.015] border-green-500/15"
                      : isError
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-transparent border-transparent opacity-40"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-500 ${
                      isCompleted ? "text-green-400 bg-green-400/10 shadow-[0_0_12px_rgba(74,222,128,0.2)]" :
                      isError ? "text-red-400 bg-red-400/10 shadow-[0_0_12px_rgba(248,113,113,0.2)]" :
                      isActive ? "text-[#facc15] bg-[#facc15]/10 shadow-[0_0_12px_rgba(250,204,21,0.3)]" :
                      "text-white/30 bg-white/5"
                    }`}>
                      {isCompleted ? <CheckCircle size={18} /> :
                       isError ? <XCircle size={18} /> :
                       isActive ? <Loader2 size={18} className="animate-spin" /> :
                       <CircleDashed size={18} />}
                    </div>
                    
                    <div className="flex-1 flex flex-col min-w-0">
                      <span className={`text-sm font-medium truncate transition-colors duration-500 ${
                        isActive ? "text-white" : isCompleted ? "text-white/80" : "text-white/50"
                      }`}>
                        {TASK_LABELS[task.task_type] || task.task_type}
                      </span>
                      
                      {/* Fixed height space for progress value to prevent layout shift */}
                      <div className="h-4 mt-0.5 overflow-hidden">
                        <AnimatePresence>
                          {isActive && task.progress !== null && (
                            <motion.span 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="text-xs text-[#facc15]/90 font-mono tracking-wider block"
                            >
                              {Math.round(task.progress)}%
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar Container - Always present with fixed height to prevent card resizing */}
                  <div className="mt-3 w-full h-1.5 bg-black/40 rounded-full overflow-hidden relative">
                    <motion.div 
                      className="absolute left-0 top-0 bottom-0 bg-[#facc15] shadow-[0_0_12px_rgba(250,204,21,0.6)]"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ 
                        width: `${isActive ? (task.progress || 0) : isCompleted ? 100 : 0}%`,
                        opacity: isActive || isCompleted ? 1 : 0
                      }}
                      transition={{ type: "spring", stiffness: 40, damping: 15 }}
                    />
                  </div>
                  
                  {isError && task.error_message && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 text-xs text-red-400/90 break-words bg-red-400/10 p-2 rounded-lg"
                    >
                      {task.error_message}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
