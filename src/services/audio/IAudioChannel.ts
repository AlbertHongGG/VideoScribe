export type AudioChannelType = 'direct' | 'stem';

/**
 * Interface representing a mutually-exclusive audio playback strategy.
 */
export interface IAudioChannel {
  readonly channelType: AudioChannelType;

  /**
   * Activates the channel and prepares audio pipelines.
   */
  activate(): Promise<void>;

  /**
   * Deactivates the channel, ensuring no sound continues to play.
   */
  deactivate(): void;

  /**
   * Starts playback on this channel.
   */
  play(): Promise<void>;

  /**
   * Pauses playback on this channel.
   */
  pause(): void;

  /**
   * Seeks to a specific timestamp in seconds.
   */
  seek(time: number): void;

  /**
   * Updates master linear volume [0.0, 1.0].
   */
  setMasterVolume(volume: number): void;

  /**
   * Updates stem-specific volumes (0 to 100), if applicable.
   */
  setStemVolumes(vocalVolume: number, backgroundVolume: number): void;

  /**
   * Updates playback rate (e.g., 0.5, 1.0, 1.25, 1.5, 2.0).
   */
  setPlaybackRate(rate: number): void;

  /**
   * Periodic synchronization hook called during time updates to correct any drift.
   */
  syncTime?(targetTime: number): void;

  /**
   * Complete release of audio context or media handles.
   */
  dispose(): void;
}
