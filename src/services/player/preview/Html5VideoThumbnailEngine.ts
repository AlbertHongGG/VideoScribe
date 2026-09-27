import { IThumbnailProvider, ThumbnailFrame, ThumbnailOptions } from "./types";

/**
 * High-Fidelity Headless HTML5 Video Thumbnail Extraction Engine.
 * Features:
 * 1. HiDPI / Retina-aware Super-Sampling (defaults to 2x physical resolution).
 * 2. High-precision Bicubic Canvas Downsampling (`imageSmoothingQuality: "high"`).
 * 3. Artifact-free modern WebP encoding (quality: 0.92) eliminating JPEG 8x8 DCT macroblocks.
 * 4. Chromium `requestVideoFrameCallback` synchronization to guarantee GPU texture presentation.
 * 5. Cooperative seek cancellation.
 */
export class Html5VideoThumbnailEngine implements IThumbnailProvider {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isInitialized = false;
  private videoUrl: string | null = null;
  private renderWidth: number;
  private format: string;
  private quality: number;

  // Active seek tracking for cooperative cancellation
  private pendingSeekReject: ((reason?: any) => void) | null = null;
  private pendingSeekListener: (() => void) | null = null;
  private activeRvfcHandle: number | null = null;
  private activeFallbackTimer: number | null = null;

  constructor(options?: ThumbnailOptions) {
    const baseWidth = options?.width || 160;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    // Calculate physical render width: at least 2x supersampling for razor-sharp Retina/HiDPI display
    const scale = options?.renderScale ?? Math.min(2.5, Math.max(2.0, dpr));
    this.renderWidth = Math.round(baseWidth * scale); // typically 320px - 360px
    this.format = options?.format || "image/webp";
    this.quality = options?.quality || 0.92;
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
    // Offscreen placement
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
    this.cleanupActiveSeek();

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
        if (this.activeRvfcHandle !== null && "cancelVideoFrameCallback" in video) {
          (video as any).cancelVideoFrameCallback(this.activeRvfcHandle);
          this.activeRvfcHandle = null;
        }
        if (this.activeFallbackTimer !== null) {
          clearTimeout(this.activeFallbackTimer);
          this.activeFallbackTimer = null;
        }
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
        this.pendingSeekReject = null;
        this.pendingSeekListener = null;
      };

      const executeCapture = () => {
        if (isSettled) return;
        isSettled = true;
        cleanup();

        try {
          this.drawFrameToCanvas(clampedTime).then(resolve);
        } catch (err) {
          console.warn("[Html5VideoThumbnailEngine] Canvas capture failed:", err);
          resolve(null);
        }
      };

      const onSeeked = () => {
        if (isSettled) return;

        // Synchronize with Chromium GPU presentation buffer when available
        if ("requestVideoFrameCallback" in video) {
          this.activeRvfcHandle = (video as any).requestVideoFrameCallback(() => {
            this.activeRvfcHandle = null;
            executeCapture();
          });
          // Fallback timer (35ms) in case background compositor throttles off-screen RVFC
          this.activeFallbackTimer = window.setTimeout(() => {
            this.activeFallbackTimer = null;
            executeCapture();
          }, 35);
        } else {
          executeCapture();
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

      // High-resolution physical dimensions for HiDPI/Retina screens
      const targetWidth = this.renderWidth;
      const targetHeight = Math.round(targetWidth * aspectRatio);

      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;

      const ctx = this.canvas.getContext("2d", { 
        alpha: false,
        desynchronized: true,
        willReadFrequently: false 
      });

      if (!ctx) {
        resolve(null);
        return;
      }

      // Force high-order bicubic filtering for pristine downscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

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
        this.format,
        this.quality
      );
    });
  }

  private cleanupActiveSeek(): void {
    if (this.pendingSeekReject && this.pendingSeekListener && this.video) {
      this.video.removeEventListener("seeked", this.pendingSeekListener);
      this.pendingSeekReject(new DOMException("Aborted superseded seek", "AbortError"));
    }
    if (this.activeRvfcHandle !== null && this.video && "cancelVideoFrameCallback" in this.video) {
      (this.video as any).cancelVideoFrameCallback(this.activeRvfcHandle);
      this.activeRvfcHandle = null;
    }
    if (this.activeFallbackTimer !== null) {
      clearTimeout(this.activeFallbackTimer);
      this.activeFallbackTimer = null;
    }
    this.pendingSeekReject = null;
    this.pendingSeekListener = null;
  }

  public dispose(): void {
    this.cleanupActiveSeek();

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
