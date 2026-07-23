import { STTResult } from "../../../types/bindings";

export interface RenderableToken {
  /** The text content of the token (can be a word or a single character) */
  text: string;
  
  /** Start time in seconds (if available) */
  start?: number;
  
  /** End time in seconds (if available) */
  end?: number;
  
  /** Furigana reading for Japanese (if fetched and available) */
  reading?: string;
  
  /** Whether the token matches a dictionary term (can be expanded later) */
  isDictionaryWord?: boolean;
}

export interface FuriganaChunk {
  surface: string;
  reading?: string;
}

export interface ProcessedSubtitle {
  /** The original STT result */
  original: STTResult;
  
  /** The processed tokens ready for deterministic rendering (KTV Layer) */
  tokens: RenderableToken[];

  /** Independent Furigana chunks generated from the full sentence (Furigana Layer) */
  furigana?: FuriganaChunk[];
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
  hoverText?: { text: string; x: number; y: number; startIndex: number } | null;
  setHoverText?: (hover: { text: string; x: number; y: number; startIndex: number } | null) => void;
  hoverTimeoutRef?: React.MutableRefObject<number | null>;

  // High-performance KTV rendering hooks
  getVideoTime?: () => number;
  isPlaying?: boolean;
}
