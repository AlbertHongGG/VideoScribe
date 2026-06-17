import React, { useRef, useEffect, useState, useMemo } from "react";
import { useVideoStore } from "../../store/videoStore";
import { useSTTStore } from "../../store/sttStore";
import { VideoControls } from "./VideoControls";
import { Upload } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { 
    videoUrl, 
    isPlaying, 
    currentTime, 
    volume,
    setIsPlaying, 
    setCurrentTime,
    setDuration 
  } = useVideoStore();

  const { results } = useSTTStore();
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);

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

  // 1. Sync video element time if the React store changes by a large amount (e.g., user seeks).
  // We strictly isolate this from memoizedResults so STT updates NEVER cause video rewinding.
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

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
    <div 
      ref={containerRef}
      className="relative w-full h-full flex flex-col bg-black overflow-hidden group"
    >
      {videoUrl ? (
        <>
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onClick={() => setIsPlaying(!isPlaying)}
          />
          
          <AnimatePresence>
            {currentSubtitle && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-28 left-0 w-full flex justify-center pointer-events-none px-12 transition-all z-30"
              >
                <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] max-w-4xl">
                  <p className="text-[#facc15] font-medium text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-center leading-relaxed tracking-wide">
                    {currentSubtitle}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-0 left-0 w-full transition-opacity duration-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100 z-40 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-20">
            <VideoControls />
          </div>
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

