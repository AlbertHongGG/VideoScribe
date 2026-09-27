import { commands, STTResult, RubySegment } from "../../../types/bindings";
import { RichSubtitleToken, ProcessedSubtitle, SubtitleRenderContext } from "./SubtitleModels";
import { TextSegmenter } from "./TextSegmenter";

export class SubtitleProcessor {
  /**
   * Processes the raw STTResult into a ProcessedSubtitle ready for rendering.
   * Single Source of Truth (SSOT): `subtitle.text` is the absolute canonical text.
   * Merges morphological segments (Ruby) and timestamps (Words) into RichSubtitleToken[].
   */
  static async process(
    subtitle: STTResult,
    context: SubtitleRenderContext
  ): Promise<ProcessedSubtitle> {
    const canonicalText = (subtitle.text || "").trim();
    if (!canonicalText) {
      return {
        original: subtitle,
        tokens: [],
      };
    }

    // 1. Morphological Analysis (Ruby Layer)
    let rubySegments: RubySegment[] | undefined = undefined;
    const isJapanese = context.language === "ja" || /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(canonicalText);

    if (isJapanese && (context.enableFurigana || context.enableDictionary)) {
      // Check if pre-annotated ruby matches canonical text
      const preAnnotatedRubyMatches = subtitle.ruby && subtitle.ruby.length > 0 &&
        subtitle.ruby.map(seg => seg.kind === "ruby" ? seg.base : seg.text).join("") === canonicalText;

      if (preAnnotatedRubyMatches) {
        rubySegments = subtitle.ruby!;
      } else {
        try {
          const res = await commands.getRubyAnnotations(canonicalText);
          if (res.status === "ok") {
            rubySegments = res.data;
          }
        } catch (e) {
          console.error("Failed to fetch Ruby annotations:", e);
        }
      }
    }

    // 2. Character-level time mapping
    // We construct a time interval [start, end] for each character in canonicalText
    const charCount = canonicalText.length;
    const sentenceStart = subtitle.start ?? 0;
    const sentenceEnd = subtitle.end ?? (sentenceStart + 1.0);
    const sentenceDuration = Math.max(sentenceEnd - sentenceStart, 0.05);

    const charTimings: { start: number; end: number }[] = new Array(charCount);

    // Check if subtitle.words matches canonicalText exactly
    const wordsMatchCanonical = subtitle.words && subtitle.words.length > 0 &&
      subtitle.words.map(w => w.text).join("") === canonicalText;

    if (wordsMatchCanonical && subtitle.words) {
      let charIdx = 0;
      for (const word of subtitle.words) {
        const wLen = word.text.length;
        const wStart = word.start ?? sentenceStart;
        const wEnd = word.end ?? sentenceEnd;
        const wDur = Math.max(wEnd - wStart, 0.01);

        for (let i = 0; i < wLen; i++) {
          if (charIdx + i < charCount) {
            charTimings[charIdx + i] = {
              start: wStart + (wDur * (i / wLen)),
              end: wStart + (wDur * ((i + 1) / wLen)),
            };
          }
        }
        charIdx += wLen;
      }
    } else {
      // Fallback: Uniformly distribute sentence duration across characters
      for (let i = 0; i < charCount; i++) {
        charTimings[i] = {
          start: sentenceStart + (sentenceDuration * (i / charCount)),
          end: sentenceStart + (sentenceDuration * ((i + 1) / charCount)),
        };
      }
    }

    // 3. Construct Unified RichSubtitleToken[]
    const tokens: RichSubtitleToken[] = [];
    const languageLocale = isJapanese ? "ja" : (context.language || "auto");

    if (rubySegments && rubySegments.length > 0) {
      // Build tokens from ruby segments
      let charAcc = 0;
      for (const seg of rubySegments) {
        if (seg.kind === "ruby") {
          const segText = seg.base;
          const segLen = segText.length;
          if (segLen === 0) continue;

          const firstCharTime = charTimings[charAcc] || { start: sentenceStart, end: sentenceEnd };
          const lastCharTime = charTimings[Math.min(charAcc + segLen - 1, charCount - 1)] || firstCharTime;

          tokens.push({
            text: segText,
            ruby: seg.ruby,
            start: firstCharTime.start,
            end: lastCharTime.end,
            charIndex: charAcc,
          });

          charAcc += segLen;
        } else {
          // Plain text segment: decompose into morphological word tokens
          const rawText = seg.text;
          if (!rawText) continue;

          const words = TextSegmenter.segment(rawText, languageLocale);
          for (const word of words) {
            const wLen = word.length;
            if (wLen === 0) continue;

            const firstCharTime = charTimings[charAcc] || { start: sentenceStart, end: sentenceEnd };
            const lastCharTime = charTimings[Math.min(charAcc + wLen - 1, charCount - 1)] || firstCharTime;

            tokens.push({
              text: word,
              start: firstCharTime.start,
              end: lastCharTime.end,
              charIndex: charAcc,
            });

            charAcc += wLen;
          }
        }
      }
    } else if (wordsMatchCanonical && subtitle.words) {
      // If no ruby, but words match, use words
      let charAcc = 0;
      for (const word of subtitle.words) {
        tokens.push({
          text: word.text,
          start: word.start ?? undefined,
          end: word.end ?? undefined,
          charIndex: charAcc,
        });
        charAcc += word.text.length;
      }
    } else {
      // Fallback: segment canonical text into words using TextSegmenter
      const words = TextSegmenter.segment(canonicalText, languageLocale);
      let charAcc = 0;
      for (const word of words) {
        const wLen = word.length;
        if (wLen === 0) continue;

        const firstCharTime = charTimings[charAcc] || { start: sentenceStart, end: sentenceEnd };
        const lastCharTime = charTimings[Math.min(charAcc + wLen - 1, charCount - 1)] || firstCharTime;

        tokens.push({
          text: word,
          start: firstCharTime.start,
          end: lastCharTime.end,
          charIndex: charAcc,
        });

        charAcc += wLen;
      }
    }

    return {
      original: subtitle,
      tokens,
      rubySegments,
    };
  }
}
