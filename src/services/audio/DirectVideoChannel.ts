import { IAudioChannel, AudioChannelType } from './IAudioChannel';
import { AudioMath } from './AudioMath';

/**
 * DirectVideoChannel - Direct Native Video Audio Strategy.
 * Plays the original video element audio with 100% 1:1 linear fidelity matching YouTube.
 * Zero intermediary Web Audio processing, zero artificial attenuation, zero secondary audio stream.
 *
 * Single Responsibility Principle (SRP):
 * The host HTMLVideoElement's playback lifecycle (play/pause/seek) is owned by the VideoPlayer
 * and PlayerCommandService. This channel strictly manages the auditory attributes of the video element
 * (mute, uncompressed linear volume, playback rate).
 */
export class DirectVideoChannel implements IAudioChannel {
  public readonly channelType: AudioChannelType = 'direct';
  private videoElement: HTMLVideoElement | null = null;
  private masterVolume: number = 1.0;
  private playbackRate: number = 1.0;
  private isActive: boolean = false;

  constructor(videoElement: HTMLVideoElement | null) {
    this.videoElement = videoElement;
  }

  public setVideoElement(element: HTMLVideoElement | null): void {
    this.videoElement = element;
    if (this.isActive && this.videoElement) {
      this.videoElement.muted = false;
      this.videoElement.volume = AudioMath.linearGain(this.masterVolume);
      this.videoElement.playbackRate = this.playbackRate;
    }
  }

  public async activate(): Promise<void> {
    this.isActive = true;
    if (this.videoElement) {
      this.videoElement.muted = false;
      this.videoElement.volume = AudioMath.linearGain(this.masterVolume);
      this.videoElement.playbackRate = this.playbackRate;
    }
  }

  public deactivate(): void {
    this.isActive = false;
    if (this.videoElement) {
      // When deactivating direct channel (e.g. switching to stem channel),
      // mute the video element so it produces no sound.
      this.videoElement.muted = true;
    }
  }

  public async play(): Promise<void> {
    // Auditory guarantee: ensure video is unmuted during direct playback
    if (this.videoElement && this.videoElement.muted) {
      this.videoElement.muted = false;
    }
  }

  public pause(): void {
    // No-op: Video playback is controlled by the host player
  }

  public seek(_time: number): void {
    // No-op: Seeking is handled directly on videoElement by the host player/service
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = volume;
    if (this.isActive && this.videoElement) {
      this.videoElement.volume = AudioMath.linearGain(volume);
    }
  }

  public setStemVolumes(_vocalVolume: number, _backgroundVolume: number): void {
    // No-op: Direct channel has no separate vocal/background stems
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.videoElement && Number.isFinite(rate) && rate > 0) {
      this.videoElement.playbackRate = rate;
    }
  }

  public dispose(): void {
    this.deactivate();
    this.videoElement = null;
  }
}
