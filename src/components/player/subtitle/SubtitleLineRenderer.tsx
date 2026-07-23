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

  // Construct the main line layout
  const mainLine = (
    <p 
      className="text-white font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-center leading-[1.8] tracking-wide"
      style={{ fontSize: `${context.sttFontSize ?? 20}px` }}
    >
      {renderedTokens}
    </p>
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
