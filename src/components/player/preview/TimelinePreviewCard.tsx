import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbnailFrame } from "../../../services/player/preview";
import { formatTime } from "../../../utils/time";

interface TimelinePreviewCardProps {
  isVisible: boolean;
  time: number;
  anchorX: number;
  frame: ThumbnailFrame | null;
  showThumbnail?: boolean;
}

/**
 * YouTube-style Minimalist Timeline Hover Preview.
 * Pure presentation view implementing zero-distraction aesthetics:
 * - Direct crystal-clear video thumbnail frame (no outer container, no loading spinners, no yellow dots).
 * - Instant 60fps time label centered directly below the thumbnail.
 * - Decoupled spatial translation from entry animation for rock-solid center alignment.
 */
export const TimelinePreviewCard: React.FC<TimelinePreviewCardProps> = ({
  isVisible,
  time,
  anchorX,
  frame,
  showThumbnail = true,
}) => {
  return (
    <div
      className="absolute bottom-full mb-3 pointer-events-none select-none z-50 flex flex-col items-center"
      style={{
        left: `${anchorX}px`,
        transform: "translateX(-50%)",
      }}
    >
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            {showThumbnail ? (
              <>
                {/* 1. Pure YouTube-Style Thumbnail Frame (No outer background card, zero distraction) */}
                <div className="w-[160px] h-[90px] bg-black rounded-[4px] overflow-hidden relative border border-white/30 shadow-[0_8px_24px_rgba(0,0,0,0.85)]">
                  {frame ? (
                    <img
                      src={frame.imageUrl}
                      alt="Timeline preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-black flex items-center justify-center" />
                  )}
                </div>

                {/* 2. Direct Centered Timestamp Badge */}
                <div className="mt-1.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur-xs text-white font-mono text-[11px] font-medium tracking-wider shadow-md">
                  {formatTime(time)}
                </div>
              </>
            ) : (
              /* Fallback time badge when thumbnail preview is turned off in settings */
              <div className="px-2.5 py-1 rounded bg-black/85 backdrop-blur-xs text-white font-mono text-[11px] font-medium tracking-wider border border-white/20 shadow-md">
                {formatTime(time)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
