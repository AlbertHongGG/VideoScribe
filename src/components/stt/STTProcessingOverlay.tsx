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
  return (
    <div className="absolute inset-0 bg-[#121212]/95 z-10 flex flex-col items-center justify-center p-8 overflow-hidden">
      <div className="w-full max-w-sm space-y-6">
        <h3 className="text-white/90 font-bold text-lg text-center tracking-wide mb-8">PROCESSING PIPELINE</h3>
        
        <div className="space-y-4">
          <AnimatePresence>
            {tasks.map((task, index) => {
              const isActive = task.status === "running";
              const isCompleted = task.status === "completed";
              const isError = task.status === "error";

              return (
                <motion.div
                  key={task.task_type}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex flex-col p-4 rounded-xl border transition-all duration-300 ${
                    isActive 
                      ? "bg-white/5 border-white/20 shadow-lg" 
                      : "bg-transparent border-transparent opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${
                      isCompleted ? "text-green-400 bg-green-400/10" :
                      isError ? "text-red-400 bg-red-400/10" :
                      isActive ? "text-yellow-400 bg-yellow-400/10" :
                      "text-white/30 bg-white/5"
                    }`}>
                      {isCompleted ? <CheckCircle size={18} /> :
                       isError ? <XCircle size={18} /> :
                       isActive ? <Loader2 size={18} className="animate-spin" /> :
                       <CircleDashed size={18} />}
                    </div>
                    
                    <div className="flex-1 flex flex-col min-w-0">
                      <span className={`text-sm font-medium truncate ${
                        isActive ? "text-white" : "text-white/70"
                      }`}>
                        {TASK_LABELS[task.task_type] || task.task_type}
                      </span>
                      {isActive && task.progress !== null && (
                        <span className="text-xs text-yellow-400/80 font-mono mt-0.5">
                          {Math.round(task.progress)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar for Active Task */}
                  {isActive && (
                    <div className="mt-3 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${task.progress || 0}%` }}
                        transition={{ type: "spring", stiffness: 40, damping: 15 }}
                        className="h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                      />
                    </div>
                  )}
                  
                  {isError && task.error_message && (
                    <div className="mt-2 text-xs text-red-400/90 break-words">
                      {task.error_message}
                    </div>
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
