import React from "react";
import { ThinkingOrb } from "thinking-orbs";
import { PipelineTask } from "../../../types/bindings";

interface Props {
  tasks: PipelineTask[];
}

export const OverlayHeader: React.FC<Props> = ({ tasks }) => {
  const hasError = tasks.some(t => t.status === "error");
  const isCancelled = !hasError && tasks.some(t => t.status === "cancelled") && tasks.every(t => t.status !== "running" && t.status !== "pending");
  const isTerminal = hasError || isCancelled;

  if (isTerminal) return null;

  return (
    <div className="flex justify-center mb-12 relative">
      <ThinkingOrb state="composing" size={64} theme="dark" />
    </div>
  );
};
