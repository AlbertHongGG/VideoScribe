import { ThumbnailFrame } from "./types";

/**
 * High-performance, memory-safe Least Recently Used (LRU) cache for video thumbnail frames.
 * Automatically revokes Blob Object URLs upon eviction to guarantee zero memory leaks.
 */
export class ThumbnailLRUCache {
  private readonly capacity: number;
  private readonly cache: Map<number, ThumbnailFrame>;

  constructor(capacity = 150) {
    this.capacity = Math.max(1, capacity);
    this.cache = new Map<number, ThumbnailFrame>();
  }

  /**
   * Retrieves a frame by quantized timestamp and marks it as most recently used.
   */
  public get(key: number): ThumbnailFrame | undefined {
    const frame = this.cache.get(key);
    if (frame) {
      // Re-insert to refresh recency in Map insertion order
      this.cache.delete(key);
      this.cache.set(key, frame);
    }
    return frame;
  }

  /**
   * Checks if a quantized timestamp is already present in cache without updating recency.
   */
  public has(key: number): boolean {
    return this.cache.has(key);
  }

  /**
   * Adds or updates a frame in the cache.
   * If capacity is exceeded, the least recently used frame is evicted and its Blob URL revoked.
   */
  public set(key: number, frame: ThumbnailFrame): void {
    if (this.cache.has(key)) {
      const oldFrame = this.cache.get(key);
      if (oldFrame && oldFrame !== frame) {
        this.revokeFrameUrl(oldFrame);
      }
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict oldest (first key in iteration)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        const oldestFrame = this.cache.get(oldestKey);
        if (oldestFrame) {
          this.revokeFrameUrl(oldestFrame);
        }
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, frame);
  }

  /**
   * Clears the entire cache, explicitly revoking all stored Blob URLs.
   */
  public clear(): void {
    for (const frame of this.cache.values()) {
      this.revokeFrameUrl(frame);
    }
    this.cache.clear();
  }

  /**
   * Returns current count of cached frames.
   */
  public get size(): number {
    return this.cache.size;
  }

  /**
   * Revokes the Object URL if it was created via URL.createObjectURL.
   */
  private revokeFrameUrl(frame: ThumbnailFrame): void {
    if (frame.imageUrl && frame.imageUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(frame.imageUrl);
      } catch (e) {
        console.warn("[ThumbnailLRUCache] Failed to revoke object URL:", e);
      }
    }
  }
}
