import React from "react";
import { AlertTriangle } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { PipelineTask } from "../../../types/bindings";

interface Props {
  tasks: PipelineTask[];
}

export const OverlayHeader: React.FC<Props> = ({ tasks }) => {
  const hasError = tasks.some(t => t.status === "error");
  const isCancelled = !hasError && tasks.some(t => t.status === "cancelled") && tasks.every(t => t.status !== "running" && t.status !== "pending");
  const isTerminal = hasError || isCancelled;

  const errorTask = tasks.find(t => t.status === "error");
  const errorMessage = errorTask?.error_message || "An unknown error occurred during STT processing.";

  return (
    <>
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
    </>
  );
};
