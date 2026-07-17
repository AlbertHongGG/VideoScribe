import React from "react";
import { motion } from "framer-motion";

interface Props {
  progress: number;
}

export const STTProcessingOverlay: React.FC<Props> = ({ progress }) => {
  return (
    <div className="absolute inset-0 bg-[#121212]/80 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 text-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full border-4 border-white/5 absolute inset-0" />
        <div className="w-16 h-16 rounded-full border-4 border-t-[#facc15] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
      </div>
      <p className="text-white font-bold text-sm mb-3 tracking-widest drop-shadow-md">PROCESSING AUDIO</p>
      
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-[#facc15] shadow-[0_0_10px_rgba(250,204,21,0.5)] relative overflow-hidden transition-all duration-300"
        />
      </div>
    </div>
  );
};
