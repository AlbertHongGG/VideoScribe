import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PipelineTask, commands } from "../../types/bindings";
import { CheckCircle, CircleDashed, Loader2, XCircle, StopCircle, AlertTriangle } from "lucide-react";
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
  // Determine the overall status of the pipeline
  const hasError = tasks.some(t => t.status === "error");
  const isCancelled = !hasError && tasks.some(t => t.status === "cancelled") && tasks.every(t => t.status !== "running" && t.status !== "pending");
  const isTerminal = hasError || isCancelled;

  const errorTask = tasks.find(t => t.status === "error");
  const errorMessage = errorTask?.error_message || "An unknown error occurred during STT processing.";

  const firstIncompleteIndex = tasks.findIndex(t => t.status !== "completed" && t.status !== "error" && t.status !== "cancelled" && t.status !== "outdated");

  return (
    <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-sm py-12">
        <div className="flex justify-center mb-12 relative">
          {hasError ? (
             <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 text-4xl shadow-[0_0_30px_rgba(239,68,68,0.2)]">
               !
             </div>
          ) : isCancelled ? (
             <div className="w-20 h-20 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 text-3xl shadow-[0_0_30px_rgba(234,179,8,0.2)]">
               <AlertTriangle size={32} />
             </div>
          ) : (
            <ThinkingOrb state="composing" size={64} theme="dark" />
          )}
        </div>

        {isTerminal && (
          <div className="text-center mb-8">
            <h3 className="text-white font-bold text-lg mb-2 tracking-wide">
              {hasError ? "Processing Failed" : "Pipeline Cancelled"}
            </h3>
            <p className={`text-sm leading-relaxed ${hasError ? "text-red-400/80" : "text-yellow-400/80"}`}>
              {hasError ? errorMessage : "The background tasks have been fully terminated. Your partial progress has been saved."}
            </p>
          </div>
        )}

        <div className="space-y-4">
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

                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className={`text-sm font-medium truncate transition-colors duration-500 ${isActive ? "text-white" : isCompleted ? "text-white/80" : "text-white/50"
                        }`}>
                        {TASK_LABELS[task.task_type] || task.task_type}
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

                  <AnimatePresence initial={false}>
                    {isTaskError && task.error_message && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="text-xs text-red-400/90 break-words bg-red-400/10 p-3 rounded-xl border border-red-400/20">
                          {task.error_message}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex justify-center"
        >
          {isTerminal ? (
            <button 
              onClick={() => {
                commands.dismissPipelineStatus().catch(console.error);
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
      </div>
    </div>
  );
};
