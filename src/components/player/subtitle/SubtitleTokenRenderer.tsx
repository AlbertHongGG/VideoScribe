import React, { useRef, useLayoutEffect } from "react";
import { RenderableToken, SubtitleRenderContext } from "./SubtitleModels";

interface SubtitleTokenRendererProps {
  token: RenderableToken;
  context: SubtitleRenderContext;
  index: number;
}

export const SubtitleTokenRenderer: React.FC<SubtitleTokenRendererProps> = ({ token, context, index }) => {
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
      
      // Direct DOM mutation! Bypass React render cycle for ultra-smooth 60FPS.
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

  // Helper: Base text node (No whitespace classes, relies on parent constraints)
  const renderTextContent = () => (
    <span>{token.text}</span>
  );

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
        x: e.clientX,
        y: e.clientY,
        startIndex: index
      });
    }
  } : {};

  const dictionaryHoverClass = context.enableDictionary ? `rounded cursor-pointer transition-colors ${
    isHovered 
      ? "text-yellow-400 bg-yellow-500/20" 
      : "hover:text-yellow-400 hover:bg-white/10"
  }` : "";

  const innerContent = (
    <span key={index} className={`relative inline-block ${dictionaryHoverClass}`} {...hoverEvents}>
      {/* 1. Spacer Layer: Invisible, dictates layout bounds for the text flow. Forced nowrap to prevent internal wrap. */}
      <span className="invisible whitespace-nowrap" aria-hidden="true">
        {renderTextContent()}
      </span>

      {/* 2. Base Layer: Default text, perfectly overlapping using absolute positioning */}
      <span className="absolute left-0 top-0 whitespace-nowrap text-white" aria-hidden="true">
        {renderTextContent()}
      </span>

      {/* 3. Highlight Layer: Active text (yellow), clipped by width mutated by RAF */}
      {isKaraokeActive && (
        <span 
          ref={highlightRef}
          className="absolute left-0 top-0 whitespace-nowrap overflow-hidden text-[#facc15]" 
          style={{ width: '0%' }}
        >
          {renderTextContent()}
        </span>
      )}
    </span>
  );

  if (context.enableFurigana && token.reading) {
    return (
      <ruby className="group/ruby leading-none" style={{ rubyPosition: "over" }}>
        {innerContent}
        <rt 
          className="text-white/90 font-semibold tracking-widest text-center pointer-events-none select-none pb-1" 
          style={{ fontSize: `${(context.sttFontSize ?? 20) * 0.45}px` }}
        >
          {token.reading}
        </rt>
      </ruby>
    );
  }

  return innerContent;
};
