import { STTResult, RubySegment } from "../../../types/bindings";

export interface RichSubtitleToken {
  /** The text content of the token (base word or Kanji) */
  text: string;
  
  /** Furigana reading if this token represents Kanji (e.g. "あたた" for "暖") */
  ruby?: string;

  /** Start time in seconds (if available) */
  start?: number;
  
  /** End time in seconds (if available) */
  end?: number;

  /** Character index within the original canonical sentence text */
  charIndex: number;
}

// Backwards-compatible alias for RenderableToken
export type RenderableToken = RichSubtitleToken;

export interface ProcessedSubtitle {
  /** The canonical STT result (Single Source of Truth) */
  original: STTResult;
  
  /** Unified rich tokens combining Text, Timing, and Furigana */
  tokens: RichSubtitleToken[];

  /** Optional raw Ruby segments for reference */
  rubySegments?: RubySegment[];
}

/** 
 * Context configuration passed down to renderers 
 */
export interface SubtitleRenderContext {
  currentTime: number;
  language: string;
  sttFontSize: number;
  translationFontSize: number;
  subtitleSpacing: number;
  enableFurigana: boolean;
  enableDictionary: boolean;
  enableKaraokeMode: boolean;
  
  // Interactive states
  hoverText?: { text: string; fullText?: string; x: number; y: number; startIndex: number; charIndex?: number } | null;
  setHoverText?: (hover: { text: string; fullText?: string; x: number; y: number; startIndex: number; charIndex?: number } | null) => void;
  hoverTimeoutRef?: React.MutableRefObject<number | null>;

  // High-performance KTV rendering hooks
  getVideoTime?: () => number;
  isPlaying?: boolean;
}
