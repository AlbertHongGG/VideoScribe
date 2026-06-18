import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useVideoStore } from "../../store/videoStore";
import { useSTTStore } from "../../store/sttStore";
import { VideoControls } from "./VideoControls";
import { Upload } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DictionaryTooltip } from "../stt/DictionaryTooltip";

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
    setSeekToTime,
    setIsFullscreen
  } = useVideoStore();

  const { results, language } = useSTTStore();
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  
  const [hoverText, setHoverText] = useState<{ text: string; x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const [videoLayout, setVideoLayout] = useState({
    containerHeight: 0,
    videoBottomEdge: 0
  });

  const updateVideoLayout = useCallback(() => {
    if (!videoRef.current || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    
    if (vw === 0 || vh === 0) return;
    
    const containerRatio = cw / ch;
    const videoRatio = vw / vh;
    
    let renderedHeight;
    if (containerRatio > videoRatio) {
      renderedHeight = ch;
    } else {
      renderedHeight = cw / videoRatio;
    }
    
    const top = (ch - renderedHeight) / 2;
    
    setVideoLayout({
      containerHeight: ch,
      videoBottomEdge: top + renderedHeight
    });
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      updateVideoLayout();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [updateVideoLayout]);

  // Memoize results to prevent unnecessary scans if results haven't changed
  const memoizedResults = useMemo(() => results, [results]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(console.error);
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, videoUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // 1. Handle explicit user seeks directly and instantly without latency.
  useEffect(() => {
    if (videoRef.current && seekToTime !== null) {
      videoRef.current.currentTime = seekToTime;
      setCurrentTime(seekToTime); // Sync UI immediately
      setSeekToTime(null);
    }
  }, [seekToTime]);

  // 2. Update subtitle text. This is purely UI and won't affect video playback.
  useEffect(() => {
    if (memoizedResults.length > 0) {
      // Opt: A linear scan here is okay for now as results length is usually < 1000
      const activeSubtitle = memoizedResults.find(r => currentTime >= r.start && currentTime <= r.end);
      setCurrentSubtitle(activeSubtitle ? activeSubtitle.text : null);
    } else {
      setCurrentSubtitle(null);
    }
  }, [currentTime, memoizedResults]);

  const lastSyncTime = useRef(0);
  const scrubTargetTime = useRef<number | null>(null);
  const scrubAnimationFrame = useRef<number | null>(null);

  // 3. Handle global hotkeys for smooth frame-by-frame scrubbing directly on the DOM
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
        setCurrentTime(newTime);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newTime = Math.min(state.duration, videoRef.current.currentTime + 1);
        videoRef.current.currentTime = newTime;
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

      // We only toggle on keydown once, so we ignore repeat events for 's'
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
        // Automatically pause video when scrubbing frame-by-frame
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
              videoRef.current.currentTime = scrubTargetTime.current;
              
              const now = performance.now();
              if (now - lastSyncTime.current > 100) {
                setCurrentTime(scrubTargetTime.current);
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
      updateVideoLayout();
    }
  };

  const distanceFromContainerBottom = videoLayout.containerHeight - videoLayout.videoBottomEdge;
  const baseBottomDistance = videoLayout.containerHeight === 0 ? 32 : distanceFromContainerBottom + 32;

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
              {currentSubtitle && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute left-0 w-full flex justify-center pointer-events-none px-12 transition-all duration-300 ease-out z-30"
                  style={{ bottom: `${baseBottomDistance}px` }}
                >
                  <div 
                    className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] max-w-4xl pointer-events-auto"
                    onMouseLeave={() => {
                      hoverTimeoutRef.current = window.setTimeout(() => setHoverText(null), 150);
                    }}
                  >
                    <p className="text-white font-medium text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-center leading-relaxed tracking-wide flex flex-wrap justify-center">
                      {language === "ja" ? (
                        Array.from(currentSubtitle).map((char, i) => (
                          <span
                            key={i}
                            className="hover:text-yellow-400 hover:bg-white/10 rounded px-px cursor-pointer transition-colors"
                            onMouseEnter={(e) => {
                              if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
                              const textToLookup = Array.from(currentSubtitle).slice(i, i + 15).join('');
                              setHoverText({
                                text: textToLookup,
                                x: e.clientX,
                                y: e.clientY
                              });
                            }}
                          >
                            {char}
                          </span>
                        ))
                      ) : (
                        currentSubtitle
                      )}
                    </p>
                  </div>
                </motion.div>
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
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-transparent to-black/40">
          <div className="p-8 rounded-full bg-white/5 mb-8 text-[#facc15] shadow-[0_0_30px_rgba(250,204,21,0.15)] ring-1 ring-white/10">
            <Upload size={56} className="opacity-80" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-white tracking-tight drop-shadow-md">
            Drop Video Here
          </h2>
          <p className="text-sm text-gray-400 tracking-[0.2em] uppercase font-semibold">
            Supports MP4, WEBM, MKV
          </p>
        </div>
      )}
    </div>
  );
};

