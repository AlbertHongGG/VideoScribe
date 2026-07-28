import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PipelineTask, commands } from "../../types/bindings";
import { CheckCircle, CircleDashed, Loader2, XCircle, StopCircle, ChevronLeft, Search } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";

interface Props {
  tasks: PipelineTask[];
}

const TASK_LABELS: Record<string, string> = {
  preprocess: "Extracting Audio",
  mss: "Separating Audio Sources",
  vad: "Detecting Voice Activity",
  stt: "Transcribing Speech",
  forced_alignment: "Aligning Subtitles",
  translation: "Translating Subtitles",
  segmentation: "Segmenting Content",
};

export const PipelineStatusOverlay: React.FC<Props> = ({ tasks }) => {
  const [selectedErrorTaskType, setSelectedErrorTaskType] = useState<string | null>(null);

  // Determine the overall status of the pipeline
  const hasError = tasks.some(t => t.status === "error");
  const isCancelled = !hasError && tasks.some(t => t.status === "cancelled") && tasks.every(t => t.status !== "running" && t.status !== "pending");
  const isTerminal = hasError || isCancelled;

  const firstIncompleteIndex = tasks.findIndex(t => t.status !== "completed" && t.status !== "error" && t.status !== "cancelled" && t.status !== "outdated");

  const selectedErrorTask = tasks.find(t => t.task_type === selectedErrorTaskType);

  if (selectedErrorTaskType && selectedErrorTask) {
    return (
      <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md z-20 flex flex-col h-full">
        <div className="flex-shrink-0 p-4 border-b border-white/10 flex items-center gap-3">
          <button
            onClick={() => setSelectedErrorTaskType(null)}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h3 className="text-white font-medium text-sm">Error Details</h3>
            <p className="text-white/40 text-xs">{TASK_LABELS[selectedErrorTask.task_type as string]}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#0f0f0f]">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 font-mono text-xs text-red-400/90 whitespace-pre-wrap break-words">
            {selectedErrorTask.error_message || "Unknown Error"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md z-10 flex flex-col h-full overflow-hidden">
      {/* Scrollable Main Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="min-h-full flex flex-col items-center px-8 py-12">
          
          <div className="flex-shrink-0 my-auto w-full max-w-sm flex flex-col items-center py-4">
            
            {/* Giant Icon */}
            {!isTerminal && (
              <div className="flex justify-center mb-10 relative">
                <ThinkingOrb state="composing" size={64} theme="dark" />
              </div>
            )}

            {/* Task List */}
            <div className="w-full space-y-3">
              <AnimatePresence mode="popLayout">
                {tasks.map((task, index) => {
                  const isCompleted = task.status === "completed";
                  const isTaskError = task.status === "error";
                  const isTaskCancelled = task.status === "cancelled" || task.status === "outdated";

                  const isCurrentTurn = index === firstIncompleteIndex;
                  const isRunning = task.status === "running";
                  const isActive = isRunning && (isCurrentTurn || (task.progress !== null && task.progress > 0));

                  return (
                    <motion.div
                      layout
                      key={task.task_type}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: 0.4,
                        delay: index * 0.05,
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

                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <span className={`text-sm font-medium truncate transition-colors duration-500 ${isActive ? "text-white" : isCompleted ? "text-white/80" : "text-white/50"
                            }`}>
                            {TASK_LABELS[task.task_type as string] || task.task_type}
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
                            
                            {isTaskError && task.error_message && (
                               <motion.button
                                 initial={{ opacity: 0, scale: 0.8 }}
                                 animate={{ opacity: 1, scale: 1 }}
                                 onClick={() => setSelectedErrorTaskType(task.task_type as string)}
                                 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/20 transition-colors"
                               >
                                 <Search size={14} />
                                 <span>View Details</span>
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
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="flex-shrink-0 border-t border-white/5 bg-black/60 backdrop-blur-xl p-4 flex justify-center z-10">
        {isTerminal ? (
          <button 
            onClick={() => {
              commands.dismissPipelineStatus().catch(console.error);
            }}
            className="w-full max-w-[240px] py-3 rounded-full bg-white/10 hover:bg-white/15 transition-colors border border-white/20 text-xs font-bold tracking-widest text-white uppercase shadow-lg shadow-black/20"
          >
            Dismiss
          </button>
        ) : (
          <button
            onClick={() => commands.cancelPipeline()}
            className="w-full max-w-[240px] flex items-center justify-center gap-2 py-3 rounded-full bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 text-white/50 hover:text-red-400 transition-all duration-300"
          >
            <StopCircle size={18} />
            <span className="text-sm font-medium tracking-wide">Cancel Process</span>
          </button>
        )}
      </div>
    </div>
  );
};
