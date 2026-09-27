import { IThumbnailProvider, ThumbnailFrame, ThumbnailOptions } from "./types";
import { ThumbnailLRUCache } from "./ThumbnailLRUCache";

export type FrameReadyCallback = (frame: ThumbnailFrame) => void;

/**
 * High-performance concurrency scheduler for timeline preview extraction.
 * Implements:
 * 1. Timestamp Quantization (dramatically improves LRU cache hit rate).
 * 2. Latest-Wins Queue (drops stale intermediate frames during fast scrubs).
 * 3. Non-blocking Async Dispatch (keeps main UI thread silky smooth at 60fps).
 */
export class PreviewScheduler {
  private readonly provider: IThumbnailProvider;
  private readonly cache: ThumbnailLRUCache;
  private quantizeInterval: number;

  private isProcessing = false;
  private nextPendingTarget: { timestamp: number; callback: FrameReadyCallback } | null = null;
  private activeAbortController: AbortController | null = null;

  constructor(provider: IThumbnailProvider, cache: ThumbnailLRUCache, options?: ThumbnailOptions) {
    this.provider = provider;
    this.cache = cache;
    this.quantizeInterval = options?.quantizeInterval || 0.5;
  }

  public setQuantizeInterval(interval: number): void {
    this.quantizeInterval = Math.max(0.1, interval);
  }

  /**
   * Quantizes the timestamp to the configured interval (e.g. 1.34s -> 1.5s with interval=0.5).
   */
  public quantize(timestamp: number): number {
    return Math.round(timestamp / this.quantizeInterval) * this.quantizeInterval;
  }

  /**
   * Schedules a frame extraction for the specified timestamp.
   * If already cached, immediately invokes the callback.
   * If busy extracting, registers as the newest pending target (superseding older pending ones).
   */
  public requestFrame(rawTimestamp: number, onFrameReady: FrameReadyCallback): void {
    const quantized = this.quantize(rawTimestamp);

    // 1. Instant Cache Hit
    const cached = this.cache.get(quantized);
    if (cached) {
      onFrameReady(cached);
      return;
    }

    // 2. Queue into Latest-Wins slot
    this.nextPendingTarget = {
      timestamp: quantized,
      callback: onFrameReady,
    };

    // 3. Trigger processing loop if idle
    if (!this.isProcessing) {
      this.drainQueue();
    }
  }

  /**
   * Cancels any pending or in-flight frame extraction.
   */
  public cancel(): void {
    this.nextPendingTarget = null;
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.isProcessing = false;
  }

  private async drainQueue(): Promise<void> {
    if (this.isProcessing || !this.nextPendingTarget) {
      return;
    }

    this.isProcessing = true;

    while (this.nextPendingTarget) {
      const currentTask = this.nextPendingTarget;
      this.nextPendingTarget = null; // Cleared so newer mouse moves can overwrite

      // Re-check cache in case it was populated
      const cached = this.cache.get(currentTask.timestamp);
      if (cached) {
        currentTask.callback(cached);
        continue;
      }

      this.activeAbortController = new AbortController();

      try {
        const frame = await this.provider.captureFrame(
          currentTask.timestamp,
          this.activeAbortController.signal
        );

        if (frame) {
          this.cache.set(currentTask.timestamp, frame);
          currentTask.callback(frame);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.warn("[PreviewScheduler] Frame extraction failed:", err);
        }
      } finally {
        this.activeAbortController = null;
      }
    }

    this.isProcessing = false;
  }
}
