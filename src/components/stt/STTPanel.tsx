import React, { useEffect, useRef } from "react";
import { useVideoStore } from "../../store/videoStore";
import { useSTTStore } from "../../store/sttStore";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifyStore } from "../../store/notifyStore";
import { STTPanelHeader } from "./STTPanelHeader";
import { STTProcessingOverlay } from "./STTProcessingOverlay";
import { STTTranslationOverlay } from "./STTTranslationOverlay";
import { STTResultList } from "./STTResultList";
import { STTEmptyState } from "./STTEmptyState";

export const STTPanel: React.FC = () => {
  const { isPanelOpen, results, status, progress, translationStatus, translationProgress } = useSTTStore();
  const { currentTime, setSeekToTime, setIsPlaying } = useVideoStore();
  const { show } = useNotifyStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef(0);

  useEffect(() => {
    if (isPanelOpen && containerRef.current) {
      containerRef.current.scrollTop = savedScrollPosition.current;
    }
  }, [isPanelOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    savedScrollPosition.current = e.currentTarget.scrollTop;
  };

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

  const showProcessing = status !== "idle" && status !== "completed";
  const showTranslating = status === "completed" && translationStatus === "translating";

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
          <STTPanelHeader 
            status={status} 
            progress={progress} 
            translationStatus={translationStatus} 
            translationProgress={translationProgress} 
          />

          <div className="flex-1 relative overflow-hidden flex flex-col">
            {showProcessing && <STTProcessingOverlay progress={progress} />}
            {showTranslating && <STTTranslationOverlay progress={translationProgress} />}

            <div 
              ref={containerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto custom-scrollbar p-4"
            >
              {results.length > 0 ? (
                <STTResultList 
                  results={results} 
                  currentTime={currentTime} 
                  onSeek={handleSeek} 
                  onCopy={handleCopy}
                  containerRef={containerRef}
                />
              ) : (
                status === "idle" && <STTEmptyState />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
