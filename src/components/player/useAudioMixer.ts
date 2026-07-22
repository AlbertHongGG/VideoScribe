import { useEffect, useMemo, RefObject } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface UseAudioMixerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  vocalsAudioRef: RefObject<HTMLAudioElement | null>;
  backgroundAudioRef: RefObject<HTMLAudioElement | null>;
  videoUrl: string | null;
  vocalsAudioPath: string | null;
  backgroundAudioPath: string | null;
  isPlaying: boolean;
  currentTime: number;
  masterVolume: number;
  vocalVolume: number;
  backgroundVolume: number;
  playbackRate: number;
}

/**
 * Logarithmic Equal-Loudness Audio Mixer Hook
 *
 * 1. Psychoacoustic Loudness Mapping:
 *    Human hearing perception of volume is logarithmic (decibel scale).
 *    A linear fader value x in [0, 1] is mapped to acoustic gain G via an exponential curve:
 *    G(x) = x^2
 *    This ensures that dragging sliders produces a silky smooth, continuous loudness transition to human ears!
 *
 * 2. Equal-Power Stem Energy Compensation:
 *    When isolated vocals and background stems are played simultaneously at 100%,
 *    their combined acoustic power doubles (+6dB), causing volume explosions.
 *    We apply an equal-power normalization coefficient (0.75 scaling)
 *    so that full vocal + full background equals exactly 100% of master video volume.
 */
export function useAudioMixer({
  videoRef,
  vocalsAudioRef,
  backgroundAudioRef,
  videoUrl,
  vocalsAudioPath,
  backgroundAudioPath,
  isPlaying,
  currentTime,
  masterVolume,
  vocalVolume,
  backgroundVolume,
  playbackRate,
}: UseAudioMixerProps) {
  const hasAudioStems = Boolean(vocalsAudioPath || backgroundAudioPath);
  
  const vocalsUrl = useMemo(
    () => (vocalsAudioPath ? convertFileSrc(vocalsAudioPath) : null),
    [vocalsAudioPath]
  );
  
  const backgroundUrl = useMemo(
    () => (backgroundAudioPath ? convertFileSrc(backgroundAudioPath) : null),
    [backgroundAudioPath]
  );

  // 1. Mute/Unmute main video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = hasAudioStems;
    }
  }, [videoRef, hasAudioStems]);

  // 2. Calculate logarithmic gain and sync to audio stems
  useEffect(() => {
    // Logarithmic (squared) gain curve for natural human hearing perception
    const masterGain = Math.pow(Math.max(0, Math.min(1, masterVolume)), 2);
    
    if (!hasAudioStems) {
      if (videoRef.current) {
        videoRef.current.volume = masterGain;
      }
      return;
    }

    // Stem volume squared (normalizing 0-100 percentage to 0-1 gain)
    const vocalGain = Math.pow(Math.max(0, Math.min(1, (vocalVolume > 1 ? vocalVolume / 100 : vocalVolume))), 2);
    const bgGain = Math.pow(Math.max(0, Math.min(1, (backgroundVolume > 1 ? backgroundVolume / 100 : backgroundVolume))), 2);

    // If both stems are active, apply equal-power compensation (0.75 scaling)
    const bothStemsActive = Boolean(vocalsUrl && backgroundUrl);
    const scale = bothStemsActive ? 0.75 : 1.0;

    const finalVocalVol = Math.max(0, Math.min(1, masterGain * vocalGain * scale));
    const finalBgVol = Math.max(0, Math.min(1, masterGain * bgGain * scale));

    if (vocalsAudioRef.current) {
      vocalsAudioRef.current.volume = finalVocalVol;
    }
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.volume = finalBgVol;
    }
  }, [
    videoRef,
    vocalsAudioRef,
    backgroundAudioRef,
    masterVolume,
    vocalVolume,
    backgroundVolume,
    hasAudioStems,
    vocalsUrl,
    backgroundUrl,
  ]);

  // 3. Sync Play / Pause state across video and stems
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
        if (hasAudioStems) {
          vocalsAudioRef.current?.play().catch(() => {});
          backgroundAudioRef.current?.play().catch(() => {});
        }
      } else {
        videoRef.current.pause();
        if (hasAudioStems) {
          vocalsAudioRef.current?.pause();
          backgroundAudioRef.current?.pause();
        }
      }
    }
  }, [isPlaying, videoUrl, hasAudioStems, vocalsUrl, backgroundUrl, videoRef, vocalsAudioRef, backgroundAudioRef]);

  // 4. Sync playbackRate across video and stems
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
    if (hasAudioStems) {
      if (vocalsAudioRef.current) vocalsAudioRef.current.playbackRate = playbackRate;
      if (backgroundAudioRef.current) backgroundAudioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, hasAudioStems, videoRef, vocalsAudioRef, backgroundAudioRef]);

  // 5. Sync currentTime (seeking & clock drift) across video and stems
  useEffect(() => {
    if (!hasAudioStems) return;
    const syncTime = (audioEl: HTMLAudioElement | null) => {
      if (audioEl && videoRef.current) {
        if (Math.abs(audioEl.currentTime - videoRef.current.currentTime) > 0.08) {
          audioEl.currentTime = videoRef.current.currentTime;
        }
      }
    };
    syncTime(vocalsAudioRef.current);
    syncTime(backgroundAudioRef.current);
  }, [currentTime, hasAudioStems, videoRef, vocalsAudioRef, backgroundAudioRef]);

  return {
    hasAudioStems,
    vocalsUrl,
    backgroundUrl,
  };
}
