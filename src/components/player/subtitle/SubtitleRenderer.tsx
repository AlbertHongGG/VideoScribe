import React, { useEffect, useState } from "react";
import { STTResult } from "../../../types/bindings";
import { SubtitleProcessor } from "./SubtitleProcessor";
import { ProcessedSubtitle, SubtitleRenderContext } from "./SubtitleModels";
import { SubtitleLineRenderer } from "./SubtitleLineRenderer";

interface SubtitleRendererProps {
  subtitle: STTResult;
  context: SubtitleRenderContext;
}

export const SubtitleRenderer: React.FC<SubtitleRendererProps> = ({ subtitle, context }) => {
  const [processedSubtitle, setProcessedSubtitle] = useState<ProcessedSubtitle | null>(null);

  useEffect(() => {
    let active = true;

    const processPipeline = async () => {
      try {
        const result = await SubtitleProcessor.process(subtitle, context);
        if (active) {
          setProcessedSubtitle(result);
        }
      } catch (e) {
        console.error("Failed to process subtitle:", e);
      }
    };

    processPipeline();

    return () => {
      active = false;
    };
  }, [subtitle, context.language, context.enableFurigana, context.enableDictionary]);
  // Note: We intentionally don't put currentTime in the dependency array above 
  // because we don't want to re-run the async Furigana fetch pipeline on every tick!
  // SubtitleLineRenderer will re-render fast with the new context on every tick.

  if (!processedSubtitle) {
    return null; // Or a minimal fallback
  }

  return <SubtitleLineRenderer processedSubtitle={processedSubtitle} context={context} />;
};
