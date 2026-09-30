import { IAudioChannel, AudioChannelType } from './IAudioChannel';
import { DirectVideoChannel } from './DirectVideoChannel';
import { StemAudioChannel } from './StemAudioChannel';

export interface AudioPlaybackConfig {
  videoElement: HTMLVideoElement | null;
  vocalsPath: string | null;
  backgroundPath: string | null;
  hasActiveStems: boolean;
  masterVolume: number;
  vocalVolume: number;
  backgroundVolume: number;
  playbackRate: number;
}

/**
 * AudioPlaybackManager - Object-Oriented Audio Channel Router & Facade.
 * Guarantees strict mutual exclusion between Direct Native Channel and Stem Channel.
 * Ensures zero dual-audio playback, zero comb filtering, and uncompromised volume fidelity.
 * 
 * Subscribes to authoritative Project domain state (hasActiveStems), completely decoupled
 * from transient UI draft settings.
 */
export class AudioPlaybackManager {
  private static instance: AudioPlaybackManager | null = null;

  private directChannel: DirectVideoChannel;
  private stemChannel: StemAudioChannel;
  private currentChannel: IAudioChannel;

  private videoElement: HTMLVideoElement | null = null;
  private vocalsPath: string | null = null;
  private backgroundPath: string | null = null;
  private hasActiveStems: boolean = false;

  private masterVolume: number = 1.0;
  private vocalVolume: number = 100;
  private backgroundVolume: number = 100;
  private playbackRate: number = 1.0;

  private isPlaying: boolean = false;

  private constructor() {
    this.directChannel = new DirectVideoChannel(null);
    this.stemChannel = new StemAudioChannel(null, null, null);
    this.currentChannel = this.directChannel;
    this.directChannel.activate().catch(console.error);
  }

  public static getInstance(): AudioPlaybackManager {
    if (!AudioPlaybackManager.instance) {
      AudioPlaybackManager.instance = new AudioPlaybackManager();
    }
    return AudioPlaybackManager.instance;
  }

  public getActiveChannelType(): AudioChannelType {
    return this.currentChannel.channelType;
  }

  /**
   * Binds or unbinds the host HTMLVideoElement.
   */
  public bindVideoElement(element: HTMLVideoElement | null): void {
    if (this.videoElement === element) return;
    this.videoElement = element;
    this.directChannel.setVideoElement(this.videoElement);
    this.stemChannel.setVideoElement(this.videoElement);
    this.evaluateAndSwitchChannel();
  }

  /**
   * Unbinds the current host element without destroying audio graphs (useful on unmount).
   * Immediately silences playback to prevent background ghost audio leakage.
   */
  public unbind(): void {
    this.pause();
    this.videoElement = null;
    this.directChannel.setVideoElement(null);
    this.stemChannel.setVideoElement(null);
  }

  /**
   * Updates playback configuration and switches channel if necessary.
   */
  public updateConfig(config: Partial<AudioPlaybackConfig>): void {
    let shouldEvaluateChannel = false;

    if (config.videoElement !== undefined && config.videoElement !== this.videoElement) {
      this.videoElement = config.videoElement;
      this.directChannel.setVideoElement(this.videoElement);
      this.stemChannel.setVideoElement(this.videoElement);
      shouldEvaluateChannel = true;
    }

    if (config.vocalsPath !== undefined && config.vocalsPath !== this.vocalsPath) {
      this.vocalsPath = config.vocalsPath;
      shouldEvaluateChannel = true;
    }

    if (config.backgroundPath !== undefined && config.backgroundPath !== this.backgroundPath) {
      this.backgroundPath = config.backgroundPath;
      shouldEvaluateChannel = true;
    }

    if (config.hasActiveStems !== undefined && config.hasActiveStems !== this.hasActiveStems) {
      this.hasActiveStems = config.hasActiveStems;
      shouldEvaluateChannel = true;
    }

    if (config.masterVolume !== undefined && config.masterVolume !== this.masterVolume) {
      this.masterVolume = config.masterVolume;
      this.currentChannel.setMasterVolume(this.masterVolume);
    }

    if (
      (config.vocalVolume !== undefined && config.vocalVolume !== this.vocalVolume) ||
      (config.backgroundVolume !== undefined && config.backgroundVolume !== this.backgroundVolume)
    ) {
      if (config.vocalVolume !== undefined) this.vocalVolume = config.vocalVolume;
      if (config.backgroundVolume !== undefined) this.backgroundVolume = config.backgroundVolume;
      this.currentChannel.setStemVolumes(this.vocalVolume, this.backgroundVolume);
    }

    if (config.playbackRate !== undefined && config.playbackRate !== this.playbackRate) {
      this.playbackRate = config.playbackRate;
      this.currentChannel.setPlaybackRate(this.playbackRate);
    }

    if (shouldEvaluateChannel) {
      this.stemChannel.updateStemPaths(this.vocalsPath, this.backgroundPath);
      this.evaluateAndSwitchChannel();
    }
  }

  /**
   * Authoritatively evaluates whether Stem Channel should be used.
   * Single Source of Truth: hasActiveStems from ProjectState AND both vocal & background stem paths exist.
   */
  private evaluateAndSwitchChannel(): void {
    const isMssActive = Boolean(
      this.hasActiveStems &&
      this.vocalsPath &&
      this.backgroundPath
    );

    const targetChannel = isMssActive ? this.stemChannel : this.directChannel;

    if (this.currentChannel !== targetChannel) {
      console.log(`[AudioPlaybackManager] Switching channel: ${this.currentChannel.channelType} -> ${targetChannel.channelType}`);
      
      const wasPlaying = this.isPlaying;
      
      // Deactivate current channel
      this.currentChannel.deactivate();

      // Switch reference
      this.currentChannel = targetChannel;

      // Apply current settings to new channel
      this.currentChannel.setMasterVolume(this.masterVolume);
      this.currentChannel.setStemVolumes(this.vocalVolume, this.backgroundVolume);
      this.currentChannel.setPlaybackRate(this.playbackRate);

      // Activate new channel
      this.currentChannel.activate().then(() => {
        if (wasPlaying) {
          this.currentChannel.play().catch(console.error);
        }
      });
    }
  }

  public async play(): Promise<void> {
    this.isPlaying = true;
    await this.currentChannel.play();
  }

  public pause(): void {
    this.isPlaying = false;
    this.currentChannel.pause();
  }

  public seek(time: number): void {
    this.currentChannel.seek(time);
  }

  public syncTime(targetTime: number): void {
    if (this.currentChannel.syncTime) {
      this.currentChannel.syncTime(targetTime);
    }
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = volume;
    this.currentChannel.setMasterVolume(volume);
  }

  public setStemVolumes(vocalVolume: number, backgroundVolume: number): void {
    this.vocalVolume = vocalVolume;
    this.backgroundVolume = backgroundVolume;
    this.currentChannel.setStemVolumes(vocalVolume, backgroundVolume);
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    this.currentChannel.setPlaybackRate(rate);
  }

  public dispose(): void {
    this.directChannel.dispose();
    this.stemChannel.dispose();
    this.videoElement = null;
    AudioPlaybackManager.instance = null;
  }
}
