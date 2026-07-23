import { invoke } from "@tauri-apps/api/core";
import { STTResult, WordTiming } from "../../../types/bindings";
import { RenderableToken, ProcessedSubtitle, SubtitleRenderContext, FuriganaChunk } from "./SubtitleModels";

export class SubtitleProcessor {
  /**
   * Processes the raw STTResult into a ProcessedSubtitle ready for rendering.
   * KTV tokens and Furigana chunks are strictly decoupled in this architecture.
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

    // 2. Morphological Analysis (Furigana Layer - Full Context Truth)
    let furigana: FuriganaChunk[] | undefined = undefined;
    const isJapanese = context.language === "ja" || /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(subtitle.text);
    
    if (isJapanese && (context.enableFurigana || context.enableDictionary)) {
      try {
        // Fetch reading based on the COMPLETE sentence context for 100% accuracy
        const fRes = await invoke<{surface: string, reading?: string}[]>("get_furigana", { text: subtitle.text });
        furigana = fRes.map(f => ({
          surface: f.surface,
          reading: f.reading
        }));
      } catch (e) {
        console.error("Failed to fetch Furigana:", e);
      }
    }

    return {
      original: subtitle,
      tokens,
      furigana
    };
  }
}
