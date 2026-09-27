import { IThumbnailProvider, ThumbnailFrame, ThumbnailOptions } from "./types";

/**
 * Headless HTML5 Video Thumbnail Extraction Engine.
 * Extracts video frames off-screen using hardware-accelerated video decoding and canvas capture.
 * Completely isolates audio (forced muted) and provides cooperative seek cancellation.
 */
export class Html5VideoThumbnailEngine implements IThumbnailProvider {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isInitialized = false;
  private videoUrl: string | null = null;
  private defaultWidth: number;
  private quality: number;

  // Active seek tracking for cooperative cancellation
  private pendingSeekReject: ((reason?: any) => void) | null = null;
  private pendingSeekListener: (() => void) | null = null;

  constructor(options?: ThumbnailOptions) {
    this.defaultWidth = options?.width || 160;
    this.quality = options?.quality || 0.75;
  }

  public async initialize(videoUrl: string): Promise<void> {
    if (this.isInitialized && this.videoUrl === videoUrl && this.video) {
      return;
    }

    this.dispose();

    this.videoUrl = videoUrl;
    const video = document.createElement("video");
    video.muted = true;
    video.volume = 0;
    video.preload = "auto";
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    // Keep offscreen styles
    video.style.position = "fixed";
    video.style.left = "-9999px";
    video.style.top = "-9999px";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";

    this.video = video;
    this.canvas = document.createElement("canvas");

    return new Promise<void>((resolve, reject) => {
      const onLoadedMetadata = () => {
        cleanup();
        this.isInitialized = true;
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error(`Failed to load video metadata for preview: ${videoUrl}`));
      };

      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("error", onError);
      };

      video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
      video.addEventListener("error", onError, { once: true });
      video.src = videoUrl;
      video.load();
    });
  }

  public async captureFrame(timestamp: number, signal?: AbortSignal): Promise<ThumbnailFrame | null> {
    if (!this.video || !this.isInitialized) {
      return null;
    }

    if (signal?.aborted) {
      return null;
    }

    // Cancel any ongoing seek operation cleanly
    if (this.pendingSeekReject && this.pendingSeekListener && this.video) {
      this.video.removeEventListener("seeked", this.pendingSeekListener);
      this.pendingSeekReject(new DOMException("Aborted superseded seek", "AbortError"));
      this.pendingSeekReject = null;
      this.pendingSeekListener = null;
    }

    const video = this.video;
    const duration = video.duration || 0;
    const clampedTime = Math.max(0, Math.min(duration, timestamp));

    return new Promise<ThumbnailFrame | null>((resolve, reject) => {
      let isSettled = false;

      const onAbort = () => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        resolve(null);
      };

      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
      }

      const cleanup = () => {
        if (this.pendingSeekListener && video) {
          video.removeEventListener("seeked", this.pendingSeekListener);
        }
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
        this.pendingSeekReject = null;
        this.pendingSeekListener = null;
      };

      const onSeeked = () => {
        if (isSettled) return;
        isSettled = true;
        cleanup();

        try {
          const frame = this.drawFrameToCanvas(clampedTime);
          resolve(frame);
        } catch (err) {
          console.warn("[Html5VideoThumbnailEngine] Canvas capture failed:", err);
          resolve(null);
        }
      };

      this.pendingSeekListener = onSeeked;
      this.pendingSeekReject = (err) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        if (err?.name === "AbortError") {
          resolve(null);
        } else {
          reject(err);
        }
      };

      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = clampedTime;
    });
  }

  private drawFrameToCanvas(timestamp: number): Promise<ThumbnailFrame | null> {
    return new Promise((resolve) => {
      if (!this.video || !this.canvas) {
        resolve(null);
        return;
      }

      const video = this.video;
      const originalWidth = video.videoWidth || 16;
      const originalHeight = video.videoHeight || 9;
      const aspectRatio = originalHeight / originalWidth;

      const targetWidth = this.defaultWidth;
      const targetHeight = Math.round(targetWidth * aspectRatio);

      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;

      const ctx = this.canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      this.canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const imageUrl = URL.createObjectURL(blob);
          resolve({
            timestamp,
            imageUrl,
            width: targetWidth,
            height: targetHeight,
          });
        },
        "image/jpeg",
        this.quality
      );
    });
  }

  public dispose(): void {
    if (this.pendingSeekReject && this.pendingSeekListener && this.video) {
      this.video.removeEventListener("seeked", this.pendingSeekListener);
      this.pendingSeekReject(new DOMException("Disposed", "AbortError"));
      this.pendingSeekReject = null;
      this.pendingSeekListener = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.removeAttribute("src");
      this.video.load();
      this.video = null;
    }

    this.canvas = null;
    this.videoUrl = null;
    this.isInitialized = false;
  }
}
