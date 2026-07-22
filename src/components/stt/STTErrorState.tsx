import React from "react";
import { useSTTJobStore } from "../../store/sttJobStore";

export const STTErrorState: React.FC = () => {
  const { tasks, reset } = useSTTJobStore();
  const errorTask = tasks.find(t => t.status === "error");
  const errorMessage = errorTask?.error_message || "An unknown error occurred during STT processing.";

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#121212]">
      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 text-red-500 text-3xl shadow-[0_0_20px_rgba(239,68,68,0.1)]">
        !
      </div>
      <h3 className="text-white font-bold text-lg mb-2 tracking-wide">Processing Failed</h3>
      <p className="text-red-400/80 text-sm mb-8 leading-relaxed max-w-[250px] break-words">
        {errorMessage}
      </p>
      
      <button 
        onClick={() => reset()}
        className="px-8 py-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-xs font-bold tracking-widest text-white uppercase"
      >
        Dismiss
      </button>
    </div>
  );
};
