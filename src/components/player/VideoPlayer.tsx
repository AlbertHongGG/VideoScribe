import React, { useRef, useEffect, useState, useMemo } from "react";
import { useVideoStore } from "../../store/videoStore";
import { useSTTJobStore } from "../../store/sttJobStore";
import { useSTTSettingsStore } from "../../store/sttSettingsStore";
import { VideoControls } from "./VideoControls";
import { AnimatePresence, motion } from "framer-motion";

import { DictionaryTooltip } from "../stt/DictionaryTooltip";
import { VideoEmptyState } from "./VideoEmptyState";
import { SubtitleRenderer } from "./subtitle/SubtitleRenderer";
import { SubtitleRenderContext, HoverState } from "./subtitle/SubtitleModels";
import { STTResult } from "../../types/bindings";
import { PlayerCommandService } from "../../services/commands/playerCommandService";
import { AudioPlaybackManager } from "../../services/audio";

export const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
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
    backgroundAudioPath,
    hasActiveStems,
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
    backgroundVolume,
  } = useSTTSettingsStore();

  // Synchronize AudioPlaybackManager configuration with current store state
  useEffect(() => {
    const audioManager = AudioPlaybackManager.getInstance();
    audioManager.updateConfig({
      videoElement: videoRef.current,
      vocalsPath: vocalsAudioPath,
      backgroundPath: backgroundAudioPath,
      hasActiveStems,
      masterVolume: volume,
      vocalVolume,
      backgroundVolume,
      playbackRate,
    });
  }, [
    videoUrl,
    vocalsAudioPath,
    backgroundAudioPath,
    hasActiveStems,
    volume,
    vocalVolume,
    backgroundVolume,
    playbackRate,
  ]);

  // Sync play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const audioManager = AudioPlaybackManager.getInstance();

    if (isPlaying) {
      if (video.paused) {
        video.play().catch((err) => {
          if (err.name !== "AbortError") console.warn("Video play error:", err);
        });
      }
      audioManager.play().catch(console.error);
    } else {
      if (!video.paused) {
        video.pause();
      }
      audioManager.pause();
    }
  }, [isPlaying]);

  const [activeSubtitle, setActiveSubtitle] = useState<STTResult | null>(null);
  const [hoverText, setHoverText] = useState<HoverState | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Memoize results to prevent unnecessary scans if results haven't changed
  const memoizedResults = useMemo(() => results, [results]);

  // Handle explicit user seeks directly and instantly without latency.
  useEffect(() => {
    if (videoRef.current && seekToTime !== null) {
      videoRef.current.currentTime = seekToTime;
      AudioPlaybackManager.getInstance().seek(seekToTime);
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

  // Sync fullscreen state with HTML5 fullscreen API
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      useVideoStore.getState().setIsFullscreen(isFs);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Attach player DOM refs to PlayerCommandService for centralized control
  useEffect(() => {
    const playerService = PlayerCommandService.getInstance();
    playerService.attachPlayer({
      video: videoRef.current,
      wrapper: playerWrapperRef.current,
    });

    return () => {
      playerService.detachPlayer();
      AudioPlaybackManager.getInstance().unbind();
    };
  }, [videoUrl]);

  const handleTimeUpdate = () => {
    if (videoRef.current && isPlaying) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);
      AudioPlaybackManager.getInstance().syncTime(cur);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      videoRef.current.playbackRate = playbackRate;
    }
  };

  const handleWaiting = () => {
    // When video pauses/stalls due to network/disk buffering, pause audio to prevent drift
    if (hasActiveStems) {
      AudioPlaybackManager.getInstance().pause();
    }
  };

  const handlePlaying = () => {
    // When video resumes playing after buffering, ensure audio channel resumes
    if (isPlaying) {
      AudioPlaybackManager.getInstance().play().catch(console.error);
    }
  };

  const handleSeeked = () => {
    // Lock stem positions immediately upon video seek completion
    if (videoRef.current) {
      AudioPlaybackManager.getInstance().seek(videoRef.current.currentTime);
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
              onWaiting={handleWaiting}
              onPlaying={handlePlaying}
              onSeeked={handleSeeked}
              onEnded={() => setIsPlaying(false)}
              onClick={() => setIsPlaying(!isPlaying)}
            />
            
            {hoverText && (
              <DictionaryTooltip
                text={hoverText.fullText || hoverText.text}
                charIndex={hoverText.charIndex}
                x={hoverText.x}
                y={hoverText.y}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
                }}
                onMouseLeave={() => {
                  hoverTimeoutRef.current = window.setTimeout(() => setHoverText(null), 150);
                }}
                onMatch={(matchLength) => {
                  setHoverText((prev) => (prev ? { ...prev, matchLength } : null));
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
            <div className="absolute bottom-0 left-0 w-full h-[210px] z-50 flex flex-col justify-end overflow-hidden group/controls">
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
