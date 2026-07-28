import React from "react";
import { ThinkingOrb } from "thinking-orbs";
import { Job } from "../../../types/bindings";

interface Props {
  currentJob: Job | null;
}

export const OverlayHeader: React.FC<Props> = ({ currentJob }) => {
  if (!currentJob) return null;
  const isTerminal = currentJob.status === "error" || currentJob.status === "cancelled" || currentJob.status === "completed";

  if (isTerminal) return null;

  return (
    <div className="flex justify-center mb-12 relative">
      <ThinkingOrb state="composing" size={64} theme="dark" />
    </div>
  );
};
