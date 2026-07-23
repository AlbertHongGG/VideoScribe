import React, { useRef, useEffect, useState, useMemo } from "react";
import { useVideoStore } from "../../store/videoStore";
import { useSTTJobStore } from "../../store/sttJobStore";
import { useSTTSettingsStore } from "../../store/sttSettingsStore";
import { useAudioMixer } from "./useAudioMixer";
import { VideoControls } from "./VideoControls";
import { AnimatePresence, motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { DictionaryTooltip } from "../stt/DictionaryTooltip";
import { VideoEmptyState } from "./VideoEmptyState";
import { SubtitleRenderer } from "./subtitle/SubtitleRenderer";
import { SubtitleRenderContext } from "./subtitle/SubtitleModels";
import { STTResult } from "../../types/bindings";

export const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const vocalsAudioRef = useRef<HTMLAudioElement>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const { 
    videoUrl, 
    isPlaying, 
    currentTime, 
    volume,
    seekToTime,
    playbackRate,
    isFullscreen,
    setIsPlaying, 
    setCurrentTime,
    setDuration,
    setSeekToTime
  } = useVideoStore();

  const { 
    results,
    vocalsAudioPath,
    backgroundAudioPath
  } = useSTTJobStore();

  const { 
    language, 
    enableDictionary, 
    showSubtitles,
    subtitlePositionX,
    subtitlePositionY,
    subtitleSpacing,
    sttFontSize,
    translationFontSize,
    enableFurigana,
    enableKaraokeMode,
    vocalVolume,
    backgroundVolume
  } = useSTTSettingsStore();

  // Unified Logarithmic Audio Mixer Hook
  const { vocalsUrl, backgroundUrl } = useAudioMixer({
    videoRef,
    vocalsAudioRef,
    backgroundAudioRef,
    videoUrl,
    vocalsAudioPath,
    backgroundAudioPath,
    isPlaying,
    currentTime,
    masterVolume: volume,
    vocalVolume,
    backgroundVolume,
    playbackRate,
  });

  const [activeSubtitle, setActiveSubtitle] = useState<STTResult | null>(null);
  const [hoverText, setHoverText] = useState<{ text: string; x: number; y: number; startIndex: number } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Memoize results to prevent unnecessary scans if results haven't changed
  const memoizedResults = useMemo(() => results, [results]);

  // Handle explicit user seeks directly and instantly without latency.
  useEffect(() => {
    if (videoRef.current && seekToTime !== null) {
      videoRef.current.currentTime = seekToTime;
      if (vocalsAudioRef.current) vocalsAudioRef.current.currentTime = seekToTime;
      if (backgroundAudioRef.current) backgroundAudioRef.current.currentTime = seekToTime;
      setCurrentTime(seekToTime); // Sync UI immediately
      setSeekToTime(null);
    }
  }, [seekToTime, setSeekToTime, setCurrentTime]);

  // Update subtitle text. Purely UI.
  useEffect(() => {
    if (memoizedResults.length > 0) {
      const active = memoizedResults.find(r => currentTime >= (r.start ?? 0) && currentTime <= (r.end ?? 0));
      setActiveSubtitle(active || null);
    } else {
      setActiveSubtitle(null);
    }
  }, [currentTime, memoizedResults]);

  const pluginContext = useMemo<SubtitleRenderContext | null>(() => {
    if (!activeSubtitle) return null;
    return {
      currentTime,
      language: language || "auto",
      sttFontSize,
      translationFontSize,
      subtitleSpacing,
      enableFurigana,
      enableDictionary,
      enableKaraokeMode,
      hoverText,
      setHoverText,
      hoverTimeoutRef,
      getVideoTime: () => videoRef.current ? videoRef.current.currentTime : currentTime,
      isPlaying
    };
  }, [
    activeSubtitle, currentTime, language, sttFontSize, translationFontSize, 
    subtitleSpacing, enableFurigana, enableDictionary, enableKaraokeMode, hoverText, isPlaying
  ]);

  const lastSyncTime = useRef(0);
  const scrubTargetTime = useRef<number | null>(null);
  const scrubAnimationFrame = useRef<number | null>(null);

  // Handle global hotkeys for smooth frame-by-frame scrubbing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!videoRef.current) return;

      const state = useVideoStore.getState();

      if (e.key === 'Enter') {
        e.preventDefault();
        const appWindow = getCurrentWindow();
        const newState = !state.isFullscreen;
        appWindow.setFullscreen(newState).catch(console.error);
        state.setIsFullscreen(newState);
        return;
      }

      if (e.key === 'Escape' && state.isFullscreen) {
        e.preventDefault();
        const appWindow = getCurrentWindow();
        appWindow.setFullscreen(false).catch(console.error);
        state.setIsFullscreen(false);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!state.isPlaying);
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newTime = Math.max(0, videoRef.current.currentTime - 1);
        videoRef.current.currentTime = newTime;
        if (vocalsAudioRef.current) vocalsAudioRef.current.currentTime = newTime;
        if (backgroundAudioRef.current) backgroundAudioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newTime = Math.min(state.duration, videoRef.current.currentTime + 1);
        videoRef.current.currentTime = newTime;
        if (vocalsAudioRef.current) vocalsAudioRef.current.currentTime = newTime;
        if (backgroundAudioRef.current) backgroundAudioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        const newRate = Math.max(0.1, state.playbackRate - 0.1);
        state.setPlaybackRate(Number(newRate.toFixed(1)));
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        const newRate = Math.min(16.0, state.playbackRate + 0.1);
        state.setPlaybackRate(Number(newRate.toFixed(1)));
        return;
      }

      if ((e.key === 's' || e.key === 'S') && !e.repeat) {
        if (state.playbackRate !== 1) {
          state.setPreviousPlaybackRate(state.playbackRate);
          state.setPlaybackRate(1);
        } else {
          state.setPlaybackRate(state.previousPlaybackRate);
        }
        return;
      }

      if (e.key === ',' || e.key === '<' || e.key === '.' || e.key === '>') {
        if (isPlaying) {
          setIsPlaying(false);
        }

        if (scrubTargetTime.current === null) {
          scrubTargetTime.current = videoRef.current.currentTime;
        }

        if (e.key === ',' || e.key === '<') {
          scrubTargetTime.current = Math.max(0, scrubTargetTime.current - 1 / 30);
        } else {
          scrubTargetTime.current = Math.min(videoRef.current.duration, scrubTargetTime.current + 1 / 30);
        }

        if (scrubAnimationFrame.current === null) {
          scrubAnimationFrame.current = requestAnimationFrame(() => {
            if (videoRef.current && scrubTargetTime.current !== null) {
              const target = scrubTargetTime.current;
              videoRef.current.currentTime = target;
              if (vocalsAudioRef.current) vocalsAudioRef.current.currentTime = target;
              if (backgroundAudioRef.current) backgroundAudioRef.current.currentTime = target;
              
              const now = performance.now();
              if (now - lastSyncTime.current > 100) {
                setCurrentTime(target);
                lastSyncTime.current = now;
              }
            }
            scrubAnimationFrame.current = null;
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ',' || e.key === '<' || e.key === '.' || e.key === '>') {
        scrubTargetTime.current = null;
        if (scrubAnimationFrame.current !== null) {
          cancelAnimationFrame(scrubAnimationFrame.current);
          scrubAnimationFrame.current = null;
        }
        if (videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isPlaying, setIsPlaying, setCurrentTime]);

  const handleTimeUpdate = () => {
    if (videoRef.current && isPlaying) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  return (
    <div ref={playerWrapperRef} className={isFullscreen ? "fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col overflow-hidden" : "w-full h-full flex flex-col bg-[#0a0a0a] overflow-hidden"}>
      {videoUrl ? (
        <>
          <div ref={containerRef} className="flex-1 min-h-0 relative w-full flex flex-col bg-black">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onClick={() => setIsPlaying(!isPlaying)}
            />
            {vocalsUrl && (
              <audio ref={vocalsAudioRef} src={vocalsUrl} preload="auto" />
            )}
            {backgroundUrl && (
              <audio ref={backgroundAudioRef} src={backgroundUrl} preload="auto" />
            )}
            
            {hoverText && (
              <DictionaryTooltip
                text={hoverText.text}
                x={hoverText.x}
                y={hoverText.y}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
                }}
                onMouseLeave={() => {
                  hoverTimeoutRef.current = window.setTimeout(() => setHoverText(null), 150);
                }}
              />
            )}
            
            <AnimatePresence>
              {showSubtitles && activeSubtitle && (
                <div
                  className="absolute pointer-events-none z-30"
                  style={{ 
                    left: `${subtitlePositionX ?? 50}%`, 
                    top: `${subtitlePositionY ?? 90}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex justify-center transition-all duration-300 ease-out px-12 w-full"
                  >
                  <div 
                    className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] max-w-4xl pointer-events-auto"
                    onMouseLeave={() => {
                      hoverTimeoutRef.current = window.setTimeout(() => setHoverText(null), 150);
                    }}
                  >
                    <div 
                      className="flex flex-col items-center w-full"
                    >
                      {pluginContext && (
                        <SubtitleRenderer 
                          subtitle={activeSubtitle}
                          context={pluginContext}
                        />
                      )}
                    </div>
                  </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {isFullscreen ? (
            <div className="absolute bottom-0 left-0 w-full h-[150px] z-50 flex flex-col justify-end overflow-hidden group/controls">
              <div className="transform translate-y-full group-hover/controls:translate-y-0 transition-transform duration-300 ease-out">
                <VideoControls />
              </div>
            </div>
          ) : (
            <div className="shrink-0 z-40 bg-black">
              <VideoControls />
            </div>
          )}
        </>
      ) : (
        <VideoEmptyState />
      )}
    </div>
  );
};
