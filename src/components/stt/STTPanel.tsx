import React, { useEffect, useRef } from "react";
import { useVideoStore } from "../../store/videoStore";
import { useSTTStore } from "../../store/sttStore";
import { formatTime } from "../../utils/time";
import { Play, AudioLines, Copy, Download, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifyStore } from "../../store/notifyStore";
import { SubtitleIOService } from "../../services/subtitleIOService";

export const STTPanel: React.FC = () => {
  const { isPanelOpen, results, status, progress, translationStatus, translationProgress } = useSTTStore();
  const { currentTime, setSeekToTime, setIsPlaying } = useVideoStore();
  const { show } = useNotifyStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef(0);

  // Restore scroll position when panel opens
  useEffect(() => {
    if (isPanelOpen && containerRef.current) {
      // Need a small timeout to ensure DOM is ready and width animation started, 
      // though immediately setting it often works if we set it without smooth behavior.
      containerRef.current.scrollTop = savedScrollPosition.current;
    }
  }, [isPanelOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    savedScrollPosition.current = e.currentTarget.scrollTop;
  };

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
  }, [currentTime]);

  const handleSeek = (time: number) => {
    setSeekToTime(time);
    setIsPlaying(true);
  };

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      show("Copied to clipboard", "success");
    }).catch((err) => {
      console.error("Failed to copy text: ", err);
      show("Failed to copy", "error");
    });
  };

  return (
    <AnimatePresence>
      {isPanelOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="h-full bg-[#121212]/95 backdrop-blur-xl border-l border-white/10 flex flex-col overflow-hidden shrink-0 z-20 shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
        >
          <div className="px-6 py-5 border-b border-white/10 bg-black/20 flex items-center justify-between">
            <h2 className="font-bold text-white tracking-[0.2em] text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] shadow-[0_0_8px_rgba(250,204,21,0.8)]"></span>
              TRANSCRIPTION
            </h2>
            
            {status !== "idle" && status !== "completed" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#facc15] font-mono font-bold tracking-wider">
                  {status === "loading_model" ? "LOADING..." : `${progress}%`}
                </span>
              </div>
            )}
            {status === "completed" && translationStatus === "translating" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#facc15] font-mono font-bold tracking-wider">
                  {translationProgress}%
                </span>
              </div>
            )}
            
            {(status === "idle" || (status === "completed" && translationStatus !== "translating")) && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => SubtitleIOService.importSubtitles()}
                  className="text-gray-400 hover:text-[#facc15] transition-colors p-1"
                  title="Import Subtitles"
                >
                  <Download size={16} />
                </button>
                <button 
                  onClick={() => SubtitleIOService.exportSubtitles()}
                  className="text-gray-400 hover:text-[#facc15] transition-colors p-1"
                  title="Export Subtitles"
                >
                  <Upload size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 relative overflow-hidden flex flex-col">
            {/* STT Processing Overlay */}
            {status !== "idle" && status !== "completed" && (
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
            )}

            {/* Translation Processing Overlay */}
            {status === "completed" && translationStatus === "translating" && (
              <div className="absolute inset-0 bg-[#121212]/80 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 text-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full border-4 border-white/5 absolute inset-0" />
                  <div className="w-16 h-16 rounded-full border-4 border-t-[#facc15] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                </div>
                <p className="text-white font-bold text-sm mb-3 tracking-widest drop-shadow-md">TRANSLATING SUBTITLES</p>
                
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${translationProgress}%` }}
                    className="h-full bg-[#facc15] shadow-[0_0_10px_rgba(250,204,21,0.5)] relative overflow-hidden transition-all duration-300"
                  />
                </div>
              </div>
            )}

            <div 
              ref={containerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto custom-scrollbar p-4"
            >
              {results.length > 0 ? (
                <div className="flex flex-col gap-3 pb-6">
                  {results.map((result, idx) => {
                    const isActive = currentTime >= result.start && currentTime <= result.end;
                    
                    return (
                      <div
                        key={idx}
                        ref={isActive ? activeItemRef : null}
                        onClick={() => handleSeek(result.start)}
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
                              onClick={(e) => handleCopy(e, result.text)}
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
              ) : (
                status === "idle" && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="relative mb-8 group">
                      {/* Background glow */}
                      <div className="absolute inset-0 bg-[#facc15]/10 rounded-full blur-2xl group-hover:bg-[#facc15]/20 transition-all duration-700"></div>
                      
                      {/* Outer dashed ring with slow spin */}
                      <div className="w-32 h-32 rounded-full border border-dashed border-white/10 flex items-center justify-center relative animate-[spin_30s_linear_infinite]"></div>
                      
                      {/* Inner solid ring & Icon */}
                      <div className="w-20 h-20 rounded-full bg-black/40 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 backdrop-blur-md">
                        <AudioLines size={32} className="text-[#facc15] opacity-80" />
                      </div>
                    </div>
                    
                    <span className="text-[10px] text-gray-500 font-bold tracking-[0.3em]">NO TRANSCRIPTION</span>
                  </div>
                )
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

