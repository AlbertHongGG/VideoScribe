export interface ThumbnailFrame {
  timestamp: number;
  imageUrl: string;
  width: number;
  height: number;
}

export interface ThumbnailOptions {
  width?: number; // Target CSS display width (default: 160)
  renderScale?: number; // Physical pixel multiplier for HiDPI/Retina (default: dynamic DPR >= 2)
  format?: "image/webp" | "image/jpeg"; // Image encoding format (default: "image/webp")
  quality?: number; // Image quality 0.0 - 1.0 (default: 0.92)
  quantizeInterval?: number; // Timestamp quantization bucket in seconds (default: 0.5)
}

export interface IThumbnailProvider {
  /**
   * Initializes the extraction provider for a given video URL/path.
   */
  initialize(videoUrl: string): Promise<void>;

  /**
   * Captures a single frame at the specified timestamp.
   * Supports AbortSignal for cancellation.
   */
  captureFrame(timestamp: number, signal?: AbortSignal): Promise<ThumbnailFrame | null>;

  /**
   * Disposes of all internal decoding resources and off-screen elements.
   */
  dispose(): void;
}
