import React, { useRef, useEffect } from "react";
import { formatTime } from "../../utils/time";
import { Play, Copy } from "lucide-react";
import { STTResult } from "../../store/sttStore";

interface Props {
  results: STTResult[];
  currentTime: number;
  onSeek: (time: number) => void;
  onCopy: (e: React.MouseEvent, text: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const STTResultList: React.FC<Props> = ({ results, currentTime, onSeek, onCopy, containerRef }) => {
  const activeItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeItemRef.current && containerRef.current) {
      const container = containerRef.current;
      const item = activeItemRef.current;
      
      const itemTop = item.offsetTop;
      const itemBottom = itemTop + item.clientHeight;
      const containerScrollTop = container.scrollTop;
      const containerScrollBottom = containerScrollTop + container.clientHeight;

      if (itemTop < containerScrollTop || itemBottom > containerScrollBottom) {
        item.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentTime, containerRef]);

  return (
    <div className="flex flex-col gap-3 pb-6">
      {results.map((result, idx) => {
        const isActive = currentTime >= result.start && currentTime <= result.end;
        
        return (
          <div
            key={idx}
            ref={isActive ? activeItemRef : null}
            onClick={() => onSeek(result.start)}
            className={`group p-4 rounded-xl cursor-pointer transition-all duration-200 ${
              isActive 
                ? "bg-[#facc15]/10 border border-[#facc15]/30 ring-1 ring-[#facc15]/30" 
                : "bg-white/5 hover:bg-white/10 border border-white/5"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[10px] font-mono font-bold tracking-widest ${isActive ? "text-[#facc15]" : "text-gray-500"}`}>
                {formatTime(result.start)}
              </span>
              <div className={`flex-1 h-px ${isActive ? "bg-gradient-to-r from-[#facc15]/50 to-transparent" : "bg-white/5"}`}></div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => onCopy(e, result.text)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white"
                  title="Copy text"
                >
                  <Copy size={13} />
                </button>
                <Play 
                  size={14} 
                  className={`opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? "text-[#facc15] opacity-100" : "text-gray-400"}`} 
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <p className={`text-sm leading-relaxed ${isActive ? "text-white font-medium" : "text-gray-400 group-hover:text-gray-200"}`}>
                {result.text}
              </p>
              {result.translation && (
                <p className={`text-xs leading-relaxed ${isActive ? "text-[#facc15]" : "text-[#facc15]/60 group-hover:text-[#facc15]/80"}`}>
                  {result.translation}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
