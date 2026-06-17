import React, { useEffect } from "react";
import { useVideoStore } from "../../store/videoStore";
import { Play, Pause, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Volume2, VolumeX } from "lucide-react";
import * as Slider from "@radix-ui/react-slider";
import { formatTime } from "../../utils/time";

export const VideoControls: React.FC = () => {
  const { 
    isPlaying, 
    currentTime, 
    duration, 
    volume,
    setIsPlaying, 
    setCurrentTime,
    setVolume,
    setSeekToTime
  } = useVideoStore();

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  
  const handleVolumeChange = (value: number[]) => setVolume(value[0]);
  
  const handleTimeChange = (value: number[]) => setSeekToTime(value[0]);

  // Robust skipTime that always reads the latest state
  const skipTime = (amount: number) => {
    const state = useVideoStore.getState();
    const newTime = Math.max(0, Math.min(state.currentTime + amount, state.duration));
    state.setSeekToTime(newTime);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept if user is typing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ',' || e.key === '<') {
        skipTime(-1 / 30);
      } else if (e.key === '.' || e.key === '>') {
        skipTime(1 / 30);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  };

  return (
    <div className="w-full px-8 pb-8 pt-6 flex flex-col gap-5 backdrop-blur-md bg-black/20 border-t border-white/5">
      {/* Progress Bar */}
      <div className="flex items-center w-full" onWheel={handleWheel}>
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5 group/slider cursor-pointer"
          value={[currentTime]}
          max={duration}
          step={0.01}
          onValueChange={handleTimeChange}
        >
          <Slider.Track className="bg-white/20 relative grow h-1 rounded-full transition-all duration-300 group-hover/slider:h-1.5 overflow-hidden">
            <Slider.Range className="absolute bg-[#facc15] h-full" />
          </Slider.Track>
          <Slider.Thumb 
            className="block w-4 h-4 bg-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.6)] rounded-full opacity-0 group-hover/slider:opacity-100 transition-all duration-200 focus:outline-none cursor-pointer scale-50 group-hover/slider:scale-100" 
            aria-label="Progress" 
          />
        </Slider.Root>
      </div>

      {/* Controls Container */}
      <div className="flex items-center justify-between w-full">
        {/* Left: Time Display */}
        <div className="w-1/3 flex justify-start">
          <div className="flex items-center gap-1.5 text-sm font-mono tracking-wide drop-shadow-md select-none">
            <span className="text-white font-medium">{formatTime(currentTime)}</span>
            <span className="text-white/40">/</span>
            <span className="text-white/60">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div className="w-1/3 flex items-center justify-center gap-4">
          <button 
            onClick={() => skipTime(-5)} 
            className="text-white/50 hover:text-white transition-all duration-200 hover:-translate-x-0.5 active:scale-95" 
            title="-5 Seconds"
          >
            <ChevronsLeft size={22} />
          </button>
          
          <button 
            onClick={() => skipTime(-1)} 
            className="text-white/50 hover:text-white transition-all duration-200 hover:-translate-x-0.5 active:scale-95" 
            title="-1 Second"
          >
            <ChevronLeft size={22} />
          </button>
          
          <button 
            onClick={handlePlayPause}
            className="w-14 h-14 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-all duration-300 hover:scale-105 active:scale-95 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] group/play mx-2"
          >
            {isPlaying ? (
              <Pause size={24} className="fill-current text-white transition-transform group-hover/play:scale-110" />
            ) : (
              <Play size={24} className="fill-current ml-1 text-white transition-transform group-hover/play:scale-110" />
            )}
          </button>
          
          <button 
            onClick={() => skipTime(1)} 
            className="text-white/50 hover:text-white transition-all duration-200 hover:translate-x-0.5 active:scale-95" 
            title="+1 Second"
          >
            <ChevronRight size={22} />
          </button>
          
          <button 
            onClick={() => skipTime(5)} 
            className="text-white/50 hover:text-white transition-all duration-200 hover:translate-x-0.5 active:scale-95" 
            title="+5 Seconds"
          >
            <ChevronsRight size={22} />
          </button>
        </div>

        {/* Right: Volume Control */}
        <div className="w-1/3 flex justify-end">
          <div className="flex items-center gap-3 w-32 group/vol hover:w-36 transition-all duration-300">
            <button 
              onClick={() => setVolume(volume === 0 ? 1 : 0)}
              className="text-white/50 hover:text-white transition-colors duration-200"
            >
              {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <Slider.Root
              className="relative flex items-center select-none touch-none w-full h-4 cursor-pointer"
              value={[volume]}
              max={1}
              step={0.05}
              onValueChange={handleVolumeChange}
            >
              <Slider.Track className="bg-white/20 relative grow h-1 rounded-full overflow-hidden transition-all group-hover/vol:h-1.5">
                <Slider.Range className="absolute bg-white/80 h-full" />
              </Slider.Track>
              <Slider.Thumb className="block w-3 h-3 bg-white shadow-md rounded-full opacity-0 scale-50 group-hover/vol:opacity-100 group-hover/vol:scale-100 transition-all duration-200 focus:outline-none" />
            </Slider.Root>
          </div>
        </div>
      </div>
    </div>
  );
};


