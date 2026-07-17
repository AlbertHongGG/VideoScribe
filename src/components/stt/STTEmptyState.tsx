import React from "react";
import { AudioLines } from "lucide-react";

export const STTEmptyState: React.FC = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="relative mb-8 group">
        <div className="absolute inset-0 bg-[#facc15]/10 rounded-full blur-2xl group-hover:bg-[#facc15]/20 transition-all duration-700"></div>
        <div className="w-32 h-32 rounded-full border border-dashed border-white/10 flex items-center justify-center relative animate-[spin_30s_linear_infinite]"></div>
        <div className="w-20 h-20 rounded-full bg-black/40 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 backdrop-blur-md">
          <AudioLines size={32} className="text-[#facc15] opacity-80" />
        </div>
      </div>
      
      <span className="text-[10px] text-gray-500 font-bold tracking-[0.3em]">NO TRANSCRIPTION</span>
    </div>
  );
};
