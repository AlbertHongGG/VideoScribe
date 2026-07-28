import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSTTJobStore } from "../../store/sttJobStore";
import { PipelineTask } from "../../types/bindings";
import { OverlayHeader } from "./overlay/OverlayHeader";
import { TaskList } from "./overlay/TaskList";
import { OverlayFooter } from "./overlay/OverlayFooter";
import { ErrorDetailsView } from "./overlay/ErrorDetailsView";

export const PipelineStatusOverlay: React.FC = () => {
  const { tasks: pipelineTasks, isOverlayVisible } = useSTTJobStore();
  const [selectedErrorTask, setSelectedErrorTask] = useState<PipelineTask | null>(null);

  if (!isOverlayVisible) return null;

  return (
    <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-sm py-12 relative">
        <AnimatePresence mode="wait">
          {!selectedErrorTask ? (
            <motion.div
              key="task-list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full relative"
            >
              <OverlayHeader tasks={pipelineTasks} />
              <TaskList 
                tasks={pipelineTasks} 
                onViewErrorDetails={(task) => setSelectedErrorTask(task)} 
              />
              <OverlayFooter tasks={pipelineTasks} />
            </motion.div>
          ) : (
            <motion.div
              key="error-details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <ErrorDetailsView 
                task={selectedErrorTask} 
                onBack={() => setSelectedErrorTask(null)} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
