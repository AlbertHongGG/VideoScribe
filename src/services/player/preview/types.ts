export interface ThumbnailFrame {
  timestamp: number;
  imageUrl: string;
  width: number;
  height: number;
}

export interface ThumbnailOptions {
  width?: number;
  quality?: number;
  quantizeInterval?: number;
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
