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

  // Unified renderer for text content with optional Furigana
  const renderTextContent = (isHighlight: boolean = false) => {
    if (token.ruby && context.enableFurigana) {
      return (
        <ruby className="inline-flex flex-col items-center align-bottom mx-[1px]">
          <rt className={`text-[0.48em] leading-none select-none pb-0.5 tracking-wider font-semibold ${
            isHighlight ? "text-[#facc15]/90" : "text-white/90"
          }`}>
            {token.ruby}
          </rt>
          <span>{token.text}</span>
        </ruby>
      );
    }
    return <span>{token.text}</span>;
  };

  // Interactive events for dictionary hover
  const isHovered = context.hoverText?.startIndex === index;
  const hoverEvents = context.enableDictionary ? {
    onMouseEnter: (e: React.MouseEvent) => {
      if (!context.setHoverText) return;
      if (context.hoverTimeoutRef?.current) {
        window.clearTimeout(context.hoverTimeoutRef.current);
      }
      
      context.setHoverText({
        text: token.text,
        fullText: fullText,
        x: e.clientX,
        y: e.clientY,
        startIndex: index,
        charIndex: token.charIndex,
      });
    }
  } : {};

  const dictionaryHoverClass = context.enableDictionary ? `rounded cursor-pointer transition-colors ${
    isHovered 
      ? "text-yellow-400 bg-yellow-500/20" 
      : "hover:text-yellow-400 hover:bg-white/10"
  }` : "";

  return (
    <span key={index} className={`relative inline-block ${dictionaryHoverClass}`} {...hoverEvents}>
      {/* 1. Spacer Layer: Invisible, dictates layout bounds for text + ruby */}
      <span className="invisible whitespace-nowrap" aria-hidden="true">
        {renderTextContent(false)}
      </span>

      {/* 2. Base Layer: Default text + ruby, perfectly overlapping using absolute positioning */}
      <span className="absolute left-0 top-0 whitespace-nowrap text-white" aria-hidden="true">
        {renderTextContent(false)}
      </span>

      {/* 3. Highlight Layer: Active text + ruby (yellow), clipped by width mutated by RAF */}
      {isKaraokeActive && (
        <span 
          ref={highlightRef} 
          className="absolute left-0 top-0 whitespace-nowrap overflow-hidden text-[#facc15] pointer-events-none z-10" 
          style={{ width: '0%' }}
          aria-hidden="true"
        >
          {renderTextContent(true)}
        </span>
      )}
    </span>
  );
};
