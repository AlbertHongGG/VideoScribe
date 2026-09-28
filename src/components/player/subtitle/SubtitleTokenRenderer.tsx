import React, { useRef, useLayoutEffect } from "react";
import { RichSubtitleToken, SubtitleRenderContext } from "./SubtitleModels";

interface SubtitleTokenRendererProps {
  token: RichSubtitleToken;
  context: SubtitleRenderContext;
  index: number;
  fullText: string;
}

export const SubtitleTokenRenderer: React.FC<SubtitleTokenRendererProps> = ({ token, context, index, fullText }) => {
  const hasWordTimings = token.start !== undefined && token.end !== undefined;
  const isKaraokeActive = context.enableKaraokeMode && hasWordTimings;
  const highlightRef = useRef<HTMLSpanElement>(null);

  // High-performance RAF loop for KTV progress
  useLayoutEffect(() => {
    if (!isKaraokeActive) return;

    let animationFrameId: number;

    const updateProgress = () => {
      if (!highlightRef.current) return;

      const duration = token.end! - token.start!;
      const currentTime = context.getVideoTime ? context.getVideoTime() : context.currentTime;
      
      let progress = 0;
      if (currentTime >= token.end!) {
        progress = 100;
      } else if (currentTime > token.start! && duration > 0) {
        progress = ((currentTime - token.start!) / duration) * 100;
      }
      
      // Direct DOM mutation for ultra-smooth 60FPS
      highlightRef.current.style.width = `${progress}%`;

      if (context.isPlaying) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    // Run once immediately to set initial state accurately without flickering
    updateProgress();

    // If playing, start the loop
    if (context.isPlaying) {
      animationFrameId = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isKaraokeActive, context.isPlaying, token.start, token.end, context.getVideoTime, context.currentTime]);

  const chars = Array.from(token.text);
  const hoverCharIdx = context.hoverText?.charIndex;
  const matchLen = context.hoverText?.matchLength ?? 1;

  // Render individual character cells with atomic hit-testing and match-range highlighting
  const renderCharacters = (layer: "spacer" | "base" | "karaoke") => {
    return chars.map((ch, i) => {
      const globalCharIdx = token.charIndex + i;
      const isWordChar = /[\p{L}\p{N}]/u.test(ch);
      const isCharInteractive = Boolean(context.enableDictionary && isWordChar);
      const isCharHighlighted =
        isCharInteractive &&
        hoverCharIdx !== undefined &&
        globalCharIdx >= hoverCharIdx &&
        globalCharIdx < hoverCharIdx + matchLen;

      if (layer === "spacer" || layer === "karaoke") {
        return (
          <span key={i} className="inline-block px-[1px]">
            {ch}
          </span>
        );
      }

      // Base layer (interactive)
      let roundingClass = "";
      if (isCharHighlighted) {
        const isFirst = globalCharIdx === hoverCharIdx;
        const isLast = globalCharIdx === hoverCharIdx + matchLen - 1;
        if (isFirst && isLast) {
          roundingClass = "rounded";
        } else if (isFirst) {
          roundingClass = "rounded-l";
        } else if (isLast) {
          roundingClass = "rounded-r";
        }
      } else if (isCharInteractive) {
        roundingClass = "rounded";
      }

      const interactiveClasses = isCharInteractive
        ? `cursor-pointer transition-colors ${roundingClass} ${
            isCharHighlighted
              ? "text-yellow-400 bg-yellow-500/20"
              : "hover:text-yellow-400 hover:bg-white/10"
          }`
        : "";

      return (
        <span
          key={i}
          className={`inline-block px-[1px] ${interactiveClasses}`}
          onMouseEnter={(e) => {
            if (!isCharInteractive || !context.setHoverText) return;
            if (context.hoverTimeoutRef?.current) {
              window.clearTimeout(context.hoverTimeoutRef.current);
            }
            context.setHoverText({
              text: ch,
              fullText: fullText,
              x: e.clientX,
              y: e.clientY,
              startIndex: index,
              charIndex: globalCharIdx,
              matchLength: 1,
            });
          }}
        >
          {ch}
        </span>
      );
    });
  };

  // Render text content with optional Furigana
  const renderContent = (layer: "spacer" | "base" | "karaoke") => {
    if (token.ruby && context.enableFurigana) {
      return (
        <ruby className="inline-flex flex-col items-center align-bottom mx-[1px]">
          <rt
            className={`text-[0.48em] leading-none select-none pb-0.5 tracking-wider font-semibold pointer-events-none ${
              layer === "karaoke" ? "text-[#facc15]/90" : "text-white/90"
            }`}
          >
            {token.ruby}
          </rt>
          <span className="inline-flex">
            {renderCharacters(layer)}
          </span>
        </ruby>
      );
    }

    return (
      <span className="inline-flex">
        {renderCharacters(layer)}
      </span>
    );
  };

  return (
    <span key={index} className="relative inline-block">
      {/* 1. Spacer Layer: Invisible, dictates layout bounds for text + ruby */}
      <span className="invisible whitespace-nowrap pointer-events-none select-none" aria-hidden="true">
        {renderContent("spacer")}
      </span>

      {/* 2. Base Layer: Default text + ruby, perfectly overlapping using absolute positioning */}
      <span className="absolute left-0 top-0 whitespace-nowrap text-white pointer-events-auto">
        {renderContent("base")}
      </span>

      {/* 3. Highlight Layer: Active text + ruby (yellow), clipped by width mutated by RAF */}
      {isKaraokeActive && (
        <span 
          ref={highlightRef} 
          className="absolute left-0 top-0 whitespace-nowrap overflow-hidden text-[#facc15] pointer-events-none z-10" 
          style={{ width: '0%' }}
          aria-hidden="true"
        >
          {renderContent("karaoke")}
        </span>
      )}
    </span>
  );
};
