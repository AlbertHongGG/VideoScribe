import { IAudioChannel, AudioChannelType } from './IAudioChannel';
import { AudioMath } from './AudioMath';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * StemAudioChannel - Separated Audio Stem Playback Strategy (MSS Mode).
 * Used exclusively when Vocal/Instrumental separation is active.
 * Routes vocal and instrumental stems through a single unified Web Audio API graph.
 * The video element is kept strictly muted.
 *
 * Architecture highlights:
 * - HTMLAudioElement instances and MediaElementAudioSourceNode instances are initialized
 *   once and reused, completely avoiding InvalidStateError on AudioContext reconnection.
 * - AudioContext is suspended on deactivation and resumed on activation.
 * - Transparent soft-knee limiter prevents digital clipping when stems are summed at high volumes.
 * - Smooth Phase-Locking (PLL) sync dynamically corrects minor clock drift without audible clicks.
 */
export class StemAudioChannel implements IAudioChannel {
  public readonly channelType: AudioChannelType = 'stem';

  private videoElement: HTMLVideoElement | null = null;
  private vocalsAudio: HTMLAudioElement | null = null;
  private backgroundAudio: HTMLAudioElement | null = null;

  private vocalsPath: string | null = null;
  private backgroundPath: string | null = null;

  private audioContext: AudioContext | null = null;
  private vocalSourceNode: MediaElementAudioSourceNode | null = null;
  private bgSourceNode: MediaElementAudioSourceNode | null = null;
  private vocalGainNode: GainNode | null = null;
  private bgGainNode: GainNode | null = null;
  private masterBusGainNode: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;

  private masterVolume: number = 1.0;
  private vocalVolume: number = 100;
  private backgroundVolume: number = 100;
  private playbackRate: number = 1.0;
  private isActive: boolean = false;

  constructor(
    videoElement: HTMLVideoElement | null,
    vocalsPath: string | null,
    backgroundPath: string | null,
  ) {
    this.videoElement = videoElement;
    this.vocalsPath = vocalsPath;
    this.backgroundPath = backgroundPath;
  }

  public setVideoElement(element: HTMLVideoElement | null): void {
    this.videoElement = element;
    if (this.isActive && this.videoElement) {
      this.videoElement.muted = true;
    }
  }

  public updateStemPaths(vocalsPath: string | null, backgroundPath: string | null): void {
    const pathsChanged = this.vocalsPath !== vocalsPath || this.backgroundPath !== backgroundPath;
    this.vocalsPath = vocalsPath;
    this.backgroundPath = backgroundPath;

    if (pathsChanged && this.isActive) {
      this.applyMediaSources();
    }
  }

  public async activate(): Promise<void> {
    this.isActive = true;

    // Ensure native video is muted while stem channel is active
    if (this.videoElement) {
      this.videoElement.muted = true;
    }

    this.ensureAudioGraphInitialized();

    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (err) {
        console.warn('[StemAudioChannel] Failed to resume AudioContext:', err);
      }
    }

    this.applyMediaSources();
  }

  public deactivate(): void {
    this.isActive = false;

    if (this.vocalsAudio) {
      this.vocalsAudio.pause();
    }
    if (this.backgroundAudio) {
      this.backgroundAudio.pause();
    }

    // Suspend AudioContext instead of closing, preserving node graph integrity
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend().catch(() => {});
    }
  }

  /**
   * Lazily initializes the Web Audio API graph and media elements exactly once.
   */
  private ensureAudioGraphInitialized(): void {
    if (this.audioContext && this.masterBusGainNode) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtxClass();

      // Master bus gain node
      this.masterBusGainNode = this.audioContext.createGain();
      this.masterBusGainNode.gain.setValueAtTime(AudioMath.linearGain(this.masterVolume), this.audioContext.currentTime);

      // Studio-grade transparent brickwall limiter (prevents inter-sample peak distortion)
      this.limiterNode = this.audioContext.createDynamicsCompressor();
      this.limiterNode.threshold.setValueAtTime(-1.0, this.audioContext.currentTime); // -1.0 dBFS ceiling
      this.limiterNode.knee.setValueAtTime(6.0, this.audioContext.currentTime);        // Smooth soft-knee (prevents pumping)
      this.limiterNode.ratio.setValueAtTime(12.0, this.audioContext.currentTime);      // Transparent mastering compression
      this.limiterNode.attack.setValueAtTime(0.01, this.audioContext.currentTime);     // 10ms attack (preserves natural vocal transients)
      this.limiterNode.release.setValueAtTime(0.1, this.audioContext.currentTime);     // 100ms release

      // Connect Master Bus -> Limiter -> Audio Output
      this.masterBusGainNode.connect(this.limiterNode);
      this.limiterNode.connect(this.audioContext.destination);

      // Vocals stem pipeline
      this.vocalsAudio = new Audio();
      this.vocalsAudio.crossOrigin = 'anonymous';
      this.vocalsAudio.preload = 'auto';
      this.vocalSourceNode = this.audioContext.createMediaElementSource(this.vocalsAudio);
      this.vocalGainNode = this.audioContext.createGain();
      this.vocalGainNode.gain.setValueAtTime(AudioMath.perceptualStemGain(this.vocalVolume), this.audioContext.currentTime);
      this.vocalSourceNode.connect(this.vocalGainNode);
      this.vocalGainNode.connect(this.masterBusGainNode);

      // Background stem pipeline
      this.backgroundAudio = new Audio();
      this.backgroundAudio.crossOrigin = 'anonymous';
      this.backgroundAudio.preload = 'auto';
      this.bgSourceNode = this.audioContext.createMediaElementSource(this.backgroundAudio);
      this.bgGainNode = this.audioContext.createGain();
      this.bgGainNode.gain.setValueAtTime(AudioMath.perceptualStemGain(this.backgroundVolume), this.audioContext.currentTime);
      this.bgSourceNode.connect(this.bgGainNode);
      this.bgGainNode.connect(this.masterBusGainNode);

    } catch (err) {
      console.error('[StemAudioChannel] Failed to initialize AudioContext graph:', err);
    }
  }

  /**
   * Updates audio element source URLs when stem paths change.
   */
  private applyMediaSources(): void {
    this.ensureAudioGraphInitialized();

    const targetTime = this.videoElement ? this.videoElement.currentTime : 0;
    const isHostPlaying = Boolean(this.videoElement && !this.videoElement.paused);
    let sourcesChanged = false;

    if (this.vocalsAudio) {
      const vocalsUrl = this.vocalsPath ? convertFileSrc(this.vocalsPath) : '';
      if (this.vocalsAudio.src !== vocalsUrl) {
        this.vocalsAudio.src = vocalsUrl;
        sourcesChanged = true;
        if (vocalsUrl) {
          this.vocalsAudio.load();
          if (targetTime > 0) {
            this.vocalsAudio.currentTime = targetTime;
            this.vocalsAudio.addEventListener('loadedmetadata', () => {
              if (this.vocalsAudio) this.vocalsAudio.currentTime = targetTime;
            }, { once: true });
          }
        }
      }
      this.vocalsAudio.playbackRate = this.playbackRate;
    }

    if (this.backgroundAudio) {
      const bgUrl = this.backgroundPath ? convertFileSrc(this.backgroundPath) : '';
      if (this.backgroundAudio.src !== bgUrl) {
        this.backgroundAudio.src = bgUrl;
        sourcesChanged = true;
        if (bgUrl) {
          this.backgroundAudio.load();
          if (targetTime > 0) {
            this.backgroundAudio.currentTime = targetTime;
            this.backgroundAudio.addEventListener('loadedmetadata', () => {
              if (this.backgroundAudio) this.backgroundAudio.currentTime = targetTime;
            }, { once: true });
          }
        }
      }
      this.backgroundAudio.playbackRate = this.playbackRate;
    }

    // Seamless hot-reload: If the host video is actively playing when sources are updated,
    // seamlessly resume playback so the audio stems don't get stuck in paused state.
    if (sourcesChanged && isHostPlaying && this.isActive) {
      this.play().catch(console.error);
    }
  }

  public async play(): Promise<void> {
    if (!this.isActive) return;

    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => {});
    }

    const promises: Promise<void>[] = [];
    if (this.vocalsAudio && this.vocalsAudio.src && this.vocalsAudio.paused) {
      promises.push(this.vocalsAudio.play().catch((err) => {
        if ((err as Error).name !== 'AbortError') console.warn('[StemAudioChannel] vocal play error:', err);
      }));
    }
    if (this.backgroundAudio && this.backgroundAudio.src && this.backgroundAudio.paused) {
      promises.push(this.backgroundAudio.play().catch((err) => {
        if ((err as Error).name !== 'AbortError') console.warn('[StemAudioChannel] background play error:', err);
      }));
    }

    await Promise.all(promises);
  }

  public pause(): void {
    if (this.vocalsAudio && !this.vocalsAudio.paused) {
      this.vocalsAudio.pause();
    }
    if (this.backgroundAudio && !this.backgroundAudio.paused) {
      this.backgroundAudio.pause();
    }
  }

  public seek(time: number): void {
    if (!Number.isFinite(time)) return;
    if (this.vocalsAudio) {
      this.vocalsAudio.currentTime = time;
    }
    if (this.backgroundAudio) {
      this.backgroundAudio.currentTime = time;
    }
  }

  /**
   * Smooth Phase-Locking (PLL) sync algorithm.
   * Dynamically corrects clock drift between video and separated stems without audible dropouts.
   * - |diff| <= 30ms: Inaudible drift, maintain base playback rate.
   * - 30ms < |diff| <= 150ms: Smoothly micro-steer stem playbackRate (+/- 2%) to bring into alignment.
   * - |diff| > 150ms: Large gap (user seek / timeline scrub), perform hard seek.
   */
  public syncTime(targetTime: number): void {
    if (!this.isActive || !Number.isFinite(targetTime)) return;
    const baseRate = this.playbackRate;

    this.syncStemTime(this.vocalsAudio, targetTime, baseRate);
    this.syncStemTime(this.backgroundAudio, targetTime, baseRate);
  }

  private syncStemTime(audio: HTMLAudioElement | null, targetTime: number, baseRate: number): void {
    if (!audio || !audio.src || audio.paused) return;

    const diff = audio.currentTime - targetTime;
    const absDiff = Math.abs(diff);

    if (absDiff > 0.15) {
      // Large drift: Hard seek
      audio.currentTime = targetTime;
      audio.playbackRate = baseRate;
    } else if (absDiff > 0.03) {
      // Micro-steer: if lagging (diff < 0), speed up by 2%; if leading (diff > 0), slow down by 2%
      const steerFactor = diff < 0 ? 1.02 : 0.98;
      audio.playbackRate = baseRate * steerFactor;
    } else {
      // Phase-locked: maintain normal playback rate
      if (audio.playbackRate !== baseRate) {
        audio.playbackRate = baseRate;
      }
    }
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = volume;
    if (this.masterBusGainNode && this.audioContext) {
      const targetGain = AudioMath.linearGain(volume);
      this.masterBusGainNode.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.015);
    }
  }

  public setStemVolumes(vocalVolume: number, backgroundVolume: number): void {
    this.vocalVolume = vocalVolume;
    this.backgroundVolume = backgroundVolume;

    if (this.audioContext) {
      const now = this.audioContext.currentTime;
      if (this.vocalGainNode) {
        const targetVocalGain = AudioMath.perceptualStemGain(vocalVolume);
        this.vocalGainNode.gain.setTargetAtTime(targetVocalGain, now, 0.015);
      }
      if (this.bgGainNode) {
        const targetBgGain = AudioMath.perceptualStemGain(backgroundVolume);
        this.bgGainNode.gain.setTargetAtTime(targetBgGain, now, 0.015);
      }
    }
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (Number.isFinite(rate) && rate > 0) {
      if (this.vocalsAudio) this.vocalsAudio.playbackRate = rate;
      if (this.backgroundAudio) this.backgroundAudio.playbackRate = rate;
    }
  }

  public dispose(): void {
    this.deactivate();

    if (this.vocalsAudio) {
      this.vocalsAudio.src = '';
      this.vocalsAudio = null;
    }
    if (this.backgroundAudio) {
      this.backgroundAudio.src = '';
      this.backgroundAudio = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.vocalSourceNode = null;
    this.bgSourceNode = null;
    this.vocalGainNode = null;
    this.bgGainNode = null;
    this.masterBusGainNode = null;
    this.limiterNode = null;
    this.videoElement = null;
  }
}
