import { commands, STTResult, WordTiming, RubySegment } from "../../../types/bindings";
import { RenderableToken, ProcessedSubtitle, SubtitleRenderContext } from "./SubtitleModels";

export class SubtitleProcessor {
  /**
   * Processes the raw STTResult into a ProcessedSubtitle ready for rendering.
   * KTV tokens and Ruby annotation segments are strictly decoupled in this architecture.
   */
  static async process(
    subtitle: STTResult,
    context: SubtitleRenderContext
  ): Promise<ProcessedSubtitle> {
    // 1. Tokenization (KTV Layer - Strict STT Truth)
    let tokens: RenderableToken[] = [];
    
    if (subtitle.words && subtitle.words.length > 0) {
      // Use Whisper word timestamps if available (Zero modification)
      tokens = subtitle.words.map((w: WordTiming) => ({
        text: w.text,
        start: w.start ?? undefined,
        end: w.end ?? undefined,
      }));
    } else {
      // If no word timestamps, treat the entire subtitle as a single token.
      tokens = [{ text: subtitle.text }];
    }

    // 2. Morphological Analysis (Ruby Layer - Full Context Truth)
    let rubySegments: RubySegment[] | undefined = undefined;
    const isJapanese = context.language === "ja" || /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(subtitle.text);
    
    if (isJapanese && (context.enableFurigana || context.enableDictionary)) {
      try {
        // Fetch ruby annotations based on the COMPLETE sentence context
        const res = await commands.getRubyAnnotations(subtitle.text);
        if (res.status === "ok") {
          rubySegments = res.data;
        }
      } catch (e) {
        console.error("Failed to fetch Ruby annotations:", e);
      }
    }

    return {
      original: subtitle,
      tokens,
      rubySegments
    };
  }
}
