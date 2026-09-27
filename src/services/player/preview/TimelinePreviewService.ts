import { IThumbnailProvider } from "./types";
import { Html5VideoThumbnailEngine } from "./Html5VideoThumbnailEngine";
import { ThumbnailLRUCache } from "./ThumbnailLRUCache";
import { PreviewScheduler, FrameReadyCallback } from "./PreviewScheduler";

/**
 * High-level Facade Service coordinating timeline preview frame extraction,
 * memory caching, concurrency scheduling, and provider strategy.
 */
export class TimelinePreviewService {
  private static instance: TimelinePreviewService | null = null;

  private provider: IThumbnailProvider;
  private cache: ThumbnailLRUCache;
  private scheduler: PreviewScheduler;
  private currentVideoUrl: string | null = null;

  private constructor() {
    this.cache = new ThumbnailLRUCache(150);
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    this.provider = new Html5VideoThumbnailEngine({
      width: 160,
      renderScale: Math.max(2.0, dpr),
      format: "image/webp",
      quality: 0.92,
    });
    this.scheduler = new PreviewScheduler(this.provider, this.cache, { quantizeInterval: 0.5 });
  }

  public static getInstance(): TimelinePreviewService {
    if (!TimelinePreviewService.instance) {
      TimelinePreviewService.instance = new TimelinePreviewService();
    }
    return TimelinePreviewService.instance;
  }

  /**
   * Initializes or re-initializes the preview engine with a video URL.
   * Clears existing frame caches when the video source changes.
   */
  public async loadVideo(videoUrl: string): Promise<void> {
    if (this.currentVideoUrl === videoUrl) {
      return;
    }

    this.scheduler.cancel();
    this.cache.clear();
    this.currentVideoUrl = videoUrl;

    try {
      await this.provider.initialize(videoUrl);
    } catch (err) {
      console.warn("[TimelinePreviewService] Failed to initialize provider:", err);
    }
  }

  /**
   * Allows hot-swapping the thumbnail provider (Strategy Pattern).
   */
  public setProvider(newProvider: IThumbnailProvider): void {
    this.scheduler.cancel();
    this.provider.dispose();
    this.provider = newProvider;
    this.scheduler = new PreviewScheduler(this.provider, this.cache);

    if (this.currentVideoUrl) {
      this.provider.initialize(this.currentVideoUrl).catch(console.error);
    }
  }

  /**
   * Requests a preview thumbnail frame for a given timestamp.
   */
  public requestFrame(timestamp: number, onFrame: FrameReadyCallback): void {
    if (!this.currentVideoUrl) return;
    this.scheduler.requestFrame(timestamp, onFrame);
  }

  /**
   * Cancels in-flight or queued requests (e.g. when cursor leaves progress bar).
   */
  public cancelPending(): void {
    this.scheduler.cancel();
  }

  /**
   * Cleans up all resources, clears caches, and disposes the provider.
   */
  public dispose(): void {
    this.scheduler.cancel();
    this.cache.clear();
    this.provider.dispose();
    this.currentVideoUrl = null;
  }
}
