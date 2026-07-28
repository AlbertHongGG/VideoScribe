import React from "react";
import { AnimatePresence } from "framer-motion";
import { PipelineTask } from "../../../types/bindings";
import { TaskCard } from "./TaskCard";

interface Props {
  tasks: PipelineTask[];
  onViewErrorDetails: (task: PipelineTask) => void;
}

export const TaskList: React.FC<Props> = ({ tasks, onViewErrorDetails }) => {
  const firstIncompleteIndex = tasks.findIndex(
    t => t.status !== "completed" && t.status !== "error" && t.status !== "cancelled" && t.status !== "outdated"
  );

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {tasks.map((task, index) => (
          <TaskCard 
            key={task.task_type} 
            task={task} 
            index={index}
            firstIncompleteIndex={firstIncompleteIndex}
            onViewErrorDetails={onViewErrorDetails} 
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
