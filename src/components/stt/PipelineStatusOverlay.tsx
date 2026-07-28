import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useSTTJobStore } from "../../store/sttJobStore";
import { PipelineTask } from "../../types/bindings";
import { OverlayHeader } from "./overlay/OverlayHeader";
import { TaskList } from "./overlay/TaskList";
import { OverlayFooter } from "./overlay/OverlayFooter";
import { ErrorDetailsView } from "./overlay/ErrorDetailsView";

export const PipelineStatusOverlay: React.FC = () => {
  const { tasks: pipelineTasks } = useSTTJobStore();
  const [selectedErrorTask, setSelectedErrorTask] = useState<PipelineTask | null>(null);

  const isPipelineActive = pipelineTasks.length > 0;
  if (!isPipelineActive) return null;

  return (
    <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-sm py-12 relative">
        <OverlayHeader tasks={pipelineTasks} />
        
        <TaskList 
          tasks={pipelineTasks} 
          onViewErrorDetails={(task) => setSelectedErrorTask(task)} 
        />
        
        <OverlayFooter tasks={pipelineTasks} />
      </div>

      {/* Detail Overlay for Errors */}
      <AnimatePresence>
        {selectedErrorTask && (
          <ErrorDetailsView 
            task={selectedErrorTask} 
            onBack={() => setSelectedErrorTask(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
