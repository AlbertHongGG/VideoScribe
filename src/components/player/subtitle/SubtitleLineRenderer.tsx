import React from "react";
import { ProcessedSubtitle, SubtitleRenderContext } from "./SubtitleModels";
import { SubtitleTokenRenderer } from "./SubtitleTokenRenderer";

interface SubtitleLineRendererProps {
  processedSubtitle: ProcessedSubtitle;
  context: SubtitleRenderContext;
}

export const SubtitleLineRenderer: React.FC<SubtitleLineRendererProps> = ({ processedSubtitle, context }) => {
  // Render each token deterministically
  const renderedTokens = processedSubtitle.tokens.map((token, idx) => (
    <SubtitleTokenRenderer key={idx} index={idx} token={token} context={context} />
  ));

  // Construct the main line layout using CSS Grid for perfect Dual-Layer overlap
  const mainLine = (
    <div className="grid text-center leading-[1.8] tracking-wide" style={{ fontSize: `${context.sttFontSize ?? 20}px` }}>
      {/* Layer 1: Base KTV Layer (Absolute STT timing truth) */}
      <div className="col-start-1 row-start-1 text-white font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-10 whitespace-nowrap">
        {renderedTokens}
      </div>

      {/* Layer 2: Furigana Overlay Layer (Absolute morphological truth) */}
      {context.enableFurigana && processedSubtitle.furigana && processedSubtitle.furigana.length > 0 && (
        <div className="col-start-1 row-start-1 pointer-events-none z-20 whitespace-nowrap" aria-hidden="true">
          {processedSubtitle.furigana.map((f, i) => (
            <span key={i} className="relative inline-block invisible">
              {f.surface}
              {f.reading && (
                <span 
                  className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 visible text-white/90 font-semibold tracking-widest text-center" 
                  style={{ fontSize: '0.45em', lineHeight: '1' }}
                >
                  {f.reading}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  // If translation is available, construct the full layout (Main + Translation)
  if (processedSubtitle.original.translation != null && processedSubtitle.original.translation.length > 0) {
    return (
      <div className="flex flex-col items-center w-full" style={{ gap: `${context.subtitleSpacing ?? 6}px` }}>
        {mainLine}
        <p 
          className="text-[#facc15] font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-center leading-relaxed tracking-wide"
          style={{ fontSize: `${context.translationFontSize ?? 18}px` }}
        >
          {processedSubtitle.original.translation}
        </p>
      </div>
    );
  }

  // Fallback to just the main line
  return (
    <div className="flex flex-col items-center w-full" style={{ gap: `${context.subtitleSpacing ?? 6}px` }}>
      {mainLine}
    </div>
  );
};
