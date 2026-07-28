import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSTTJobStore } from "../../store/sttJobStore";
import { OverlayHeader } from "./overlay/OverlayHeader";
import { TaskList } from "./overlay/TaskList";
import { OverlayFooter } from "./overlay/OverlayFooter";
export const PipelineStatusOverlay: React.FC = () => {
  const { tasks: pipelineTasks, isOverlayVisible } = useSTTJobStore();

  if (!isOverlayVisible) return null;

  return (
    <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md z-10 overflow-y-auto custom-scrollbar">
      <div className="min-h-full flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm py-8 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key="task-list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full relative"
          >
            <OverlayHeader tasks={pipelineTasks} />
            <TaskList tasks={pipelineTasks} />
            <OverlayFooter tasks={pipelineTasks} />
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
