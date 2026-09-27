/**
 * TextSegmenter
 * High-performance, character-lossless morphological word segmentation for subtitles.
 * Utilizes standard ECMAScript Intl.Segmenter with Unicode regex fallback.
 */
export class TextSegmenter {
  private static segmenterCache = new Map<string, Intl.Segmenter>();

  /**
   * Retrieves or creates a cached Intl.Segmenter instance for the given locale.
   */
  private static getSegmenter(locale: string): Intl.Segmenter | null {
    if (typeof Intl === "undefined" || !("Segmenter" in Intl)) {
      return null;
    }

    const normalizedLocale = (!locale || locale === "auto") ? "ja" : locale;
    let seg = this.segmenterCache.get(normalizedLocale);
    if (!seg) {
      try {
        seg = new Intl.Segmenter(normalizedLocale, { granularity: "word" });
        this.segmenterCache.set(normalizedLocale, seg);
      } catch (e) {
        console.warn(`Failed to initialize Intl.Segmenter for locale: ${normalizedLocale}`, e);
        return null;
      }
    }
    return seg;
  }

  /**
   * Segments the input text into morphological word/token slices.
   * Invariant: `result.join("") === text` (100% character-lossless).
   */
  public static segment(text: string, locale = "ja"): string[] {
    if (!text) return [];

    const segmenter = this.getSegmenter(locale);
    if (segmenter) {
      const segments: string[] = [];
      const iterator = segmenter.segment(text);
      for (const item of iterator) {
        segments.push(item.segment);
      }
      return segments;
    }

    // Fallback for environments lacking Intl.Segmenter:
    // Split preserving word characters and non-word separators losslessly
    const parts = text.split(/(\s+|[^\p{L}\p{N}]+)/u).filter(Boolean);
    return parts.length > 0 ? parts : [text];
  }
}
