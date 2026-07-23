import { invoke } from "@tauri-apps/api/core";
import { STTResult, WordTiming } from "../../../types/bindings";
import { RenderableToken, ProcessedSubtitle, SubtitleRenderContext } from "./SubtitleModels";

export class SubtitleProcessor {
  /**
   * Processes the raw STTResult into a ProcessedSubtitle ready for rendering.
   * This handles tokenization and fetching asynchronous data like Furigana.
   */
  static async process(
    subtitle: STTResult,
    context: SubtitleRenderContext
  ): Promise<ProcessedSubtitle> {
    // 1. Initial Tokenization
    let tokens: RenderableToken[] = [];
    
    if (subtitle.words && subtitle.words.length > 0) {
      // Use Whisper word timestamps if available
      tokens = subtitle.words.map((w: WordTiming) => ({
        text: w.text,
        start: w.start ?? undefined,
        end: w.end ?? undefined,
      }));
    } else {
      // If no word timestamps, treat the entire subtitle as a single token.
      tokens = [{ text: subtitle.text }];
    }

    // 2. Fetch Furigana if Japanese and enabled
    const isJapanese = context.language === "ja" || /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(subtitle.text);
    if (isJapanese && (context.enableFurigana || context.enableDictionary)) {
      tokens = await this.augmentWithFurigana(tokens, subtitle.text);
    }

    return {
      original: subtitle,
      tokens
    };
  }

  private static async augmentWithFurigana(
    tokens: RenderableToken[],
    fullText: string
  ): Promise<RenderableToken[]> {
    try {
      if (tokens.length > 0 && tokens[0].start !== undefined) {
        // We have word-level tokens, fetch furigana per word token
        const newTokens: RenderableToken[] = [];
        
        for (const t of tokens) {
          const fRes = await invoke<{surface: string, reading?: string}[]>("get_furigana", { text: t.text });
          
          if (fRes.length === 0) {
            newTokens.push(t);
            continue;
          }
          
          // Distribute time equally among sub-tokens for Karaoke fallback within the word
          const duration = (t.end! - t.start!) / fRes.length;
          fRes.forEach((f, i) => {
            newTokens.push({
              text: f.surface,
              reading: f.reading,
              start: t.start! + i * duration,
              end: t.start! + (i + 1) * duration,
            });
          });
        }
        return newTokens;
      } else {
        // No word timestamps, just fetch for the whole text and create new tokens
        const res = await invoke<{surface: string, reading?: string}[]>("get_furigana", { text: fullText });
        return res.map(f => ({
          text: f.surface,
          reading: f.reading
        }));
      }
    } catch (e) {
      console.error("Failed to fetch Furigana:", e);
      return tokens;
    }
  }
}
