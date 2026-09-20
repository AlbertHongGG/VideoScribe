import { useVideoStore } from "../../store/videoStore";

export interface AttachedPlayerElements {
  video: HTMLVideoElement | null;
  vocalsAudio?: HTMLAudioElement | null;
  backgroundAudio?: HTMLAudioElement | null;
  wrapper?: HTMLElement | null;
}

/**
 * 播放器控制指令門面服務 (Facade Pattern)
 * 統一管理影音跳轉、播放速度、全螢幕與逐幀微調
 */
export class PlayerCommandService {
  private static instance: PlayerCommandService | null = null;

  private videoElement: HTMLVideoElement | null = null;
  private vocalsAudioElement: HTMLAudioElement | null = null;
  private backgroundAudioElement: HTMLAudioElement | null = null;
  private wrapperElement: HTMLElement | null = null;

  private scrubTargetTime: number | null = null;
  private scrubAnimationFrame: number | null = null;
  private lastSyncTime = 0;

  private constructor() {}

  static getInstance(): PlayerCommandService {
    if (!PlayerCommandService.instance) {
      PlayerCommandService.instance = new PlayerCommandService();
    }
    return PlayerCommandService.instance;
  }

  /**
   * 綁定播放器 DOM 節點
   */
  attachPlayer(elements: AttachedPlayerElements): void {
    this.videoElement = elements.video;
    this.vocalsAudioElement = elements.vocalsAudio ?? null;
    this.backgroundAudioElement = elements.backgroundAudio ?? null;
    this.wrapperElement = elements.wrapper ?? null;
  }

  /**
   * 解除播放器 DOM 綁定
   */
  detachPlayer(): void {
    this.stopFrameScrub();
    this.videoElement = null;
    this.vocalsAudioElement = null;
    this.backgroundAudioElement = null;
    this.wrapperElement = null;
  }

  /**
   * 檢查當前是否已有載入影片
   */
  hasVideo(): boolean {
    const state = useVideoStore.getState();
    return !!state.videoUrl || !!this.videoElement;
  }

  /**
   * 相對時間跳轉 (秒)
   * 同步更新視訊與伴奏/人聲音訊軌道，並施加邊界防護 [0, duration]
   */
  seekRelative(deltaSeconds: number): void {
    const state = useVideoStore.getState();
    const current = this.videoElement ? this.videoElement.currentTime : state.currentTime;
    const duration = state.duration || (this.videoElement ? this.videoElement.duration : 0);
    const targetTime = Math.max(0, Math.min(current + deltaSeconds, duration));

    if (this.videoElement) {
      this.videoElement.currentTime = targetTime;
      if (this.vocalsAudioElement) this.vocalsAudioElement.currentTime = targetTime;
      if (this.backgroundAudioElement) this.backgroundAudioElement.currentTime = targetTime;
      state.setCurrentTime(targetTime);
    } else {
      state.setSeekToTime(targetTime);
    }
  }

  /**
   * 切換播放 / 暫停
   */
  togglePlayPause(): void {
    const state = useVideoStore.getState();
    state.setIsPlaying(!state.isPlaying);
  }

  /**
   * 調整播放速率
   */
  adjustPlaybackRate(delta: number): void {
    const state = useVideoStore.getState();
    const newRate = Math.max(0.1, Math.min(16.0, Number((state.playbackRate + delta).toFixed(1))));
    state.setPlaybackRate(newRate);
  }

  /**
   * 重設或切換回前一次播放速率 (S 鍵)
   */
  resetPlaybackRate(): void {
    const state = useVideoStore.getState();
    if (state.playbackRate !== 1) {
      state.setPreviousPlaybackRate(state.playbackRate);
      state.setPlaybackRate(1);
    } else {
      state.setPlaybackRate(state.previousPlaybackRate);
    }
  }

  /**
   * 切換全螢幕
   */
  toggleFullscreen(target?: HTMLElement | null): void {
    const element = target || this.wrapperElement;
    if (!document.fullscreenElement) {
      if (element) {
        element.requestFullscreen().catch((err) => console.error("Request fullscreen failed:", err));
      }
    } else {
      document.exitFullscreen().catch((err) => console.error("Exit fullscreen failed:", err));
    }
  }

  /**
   * 退出全螢幕
   */
  exitFullscreen(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => console.error("Exit fullscreen failed:", err));
    }
  }

  /**
   * 啟動逐幀微調 (Continuous Frame Scrubbing)
   * @param direction -1 代表倒退一幀，1 代表前進一幀 (以 30fps 計算約 1/30 秒)
   */
  startFrameScrub(direction: -1 | 1): void {
    if (!this.videoElement) return;

    const state = useVideoStore.getState();
    if (state.isPlaying) {
      state.setIsPlaying(false);
    }

    if (this.scrubTargetTime === null) {
      this.scrubTargetTime = this.videoElement.currentTime;
    }

    const duration = this.videoElement.duration || state.duration;
    if (direction === -1) {
      this.scrubTargetTime = Math.max(0, this.scrubTargetTime - 1 / 30);
    } else {
      this.scrubTargetTime = Math.min(duration, this.scrubTargetTime + 1 / 30);
    }

    if (this.scrubAnimationFrame === null) {
      this.scrubAnimationFrame = requestAnimationFrame(() => {
        if (this.videoElement && this.scrubTargetTime !== null) {
          const target = this.scrubTargetTime;
          this.videoElement.currentTime = target;
          if (this.vocalsAudioElement) this.vocalsAudioElement.currentTime = target;
          if (this.backgroundAudioElement) this.backgroundAudioElement.currentTime = target;

          const now = performance.now();
          if (now - this.lastSyncTime > 100) {
            useVideoStore.getState().setCurrentTime(target);
            this.lastSyncTime = now;
          }
        }
        this.scrubAnimationFrame = null;
      });
    }
  }

  /**
   * 停止逐幀微調並同步最終時間
   */
  stopFrameScrub(): void {
    this.scrubTargetTime = null;
    if (this.scrubAnimationFrame !== null) {
      cancelAnimationFrame(this.scrubAnimationFrame);
      this.scrubAnimationFrame = null;
    }
    if (this.videoElement) {
      useVideoStore.getState().setCurrentTime(this.videoElement.currentTime);
    }
  }
}
