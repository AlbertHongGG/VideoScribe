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
    playbackRate,
    setIsPlaying, 
    setCurrentTime,
    setVolume,
    setSeekToTime
  } = useVideoStore();

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  
  const handleVolumeChange = (value: number[]) => setVolume(value[0]);
  
  const handleTimeChange = (value: number[]) => setSeekToTime(value[0]);

  const skipTime = (amount: number) => {
    const state = useVideoStore.getState();
    const newTime = Math.max(0, Math.min(state.currentTime + amount, state.duration));
    state.setSeekToTime(newTime);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  };

  return (
    <div className="w-full h-[72px] flex flex-col justify-center bg-[#080808] border-t border-white/5 select-none px-6 gap-2">
      
      {/* Top Row: Progress Bar */}
      <div className="w-full flex items-center h-4" onWheel={handleWheel}>
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-full group/slider cursor-pointer"
          value={[currentTime]}
          max={duration}
          step={0.01}
          onValueChange={handleTimeChange}
        >
          <Slider.Track className="bg-white/10 relative grow h-[3px] rounded-full transition-all duration-300 group-hover/slider:h-[5px] overflow-hidden">
            <Slider.Range className="absolute bg-[#facc15] h-full" />
          </Slider.Track>
          <Slider.Thumb 
            className="block w-2.5 h-2.5 bg-[#facc15] shadow-[0_0_8px_rgba(250,204,21,0.5)] rounded-full opacity-0 group-hover/slider:opacity-100 transition-all duration-200 focus:outline-none cursor-pointer scale-50 group-hover/slider:scale-100" 
            aria-label="Progress" 
          />
        </Slider.Root>
      </div>

      {/* Bottom Row: Controls */}
      <div className="flex items-center justify-between w-full">
        
        {/* Left: Time */}
        <div className="w-1/3 flex justify-start">
          <div className="text-[11px] font-mono tracking-widest text-white/30 text-center pointer-events-none">
            <span className="text-white/80 font-medium">{formatTime(currentTime)}</span> / {formatTime(duration)}
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div className="w-1/3 flex items-center justify-center gap-3 text-white/40">
          <button onClick={() => skipTime(-5)} className="hover:text-white transition-colors p-1" title="-5s">
            <ChevronsLeft size={16} />
          </button>
          <button onClick={() => skipTime(-1)} className="hover:text-white transition-colors p-1" title="-1s">
            <ChevronLeft size={16} />
          </button>
          
          <button 
            onClick={handlePlayPause}
            className="text-white/90 hover:text-[#facc15] transition-colors flex items-center justify-center focus:outline-none mx-2"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={18} className="fill-current" />
            ) : (
              <Play size={18} className="fill-current ml-0.5" />
            )}
          </button>

          <button onClick={() => skipTime(1)} className="hover:text-white transition-colors p-1" title="+1s">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => skipTime(5)} className="hover:text-white transition-colors p-1" title="+5s">
            <ChevronsRight size={16} />
          </button>
        </div>

        {/* Right: Volume Control & Speed */}
        <div className="w-1/3 flex justify-end items-center gap-3">
          {/* Speed Display */}
          {playbackRate !== 1 && (
            <div className="text-[10px] font-mono text-[#facc15] bg-[#facc15]/10 px-1.5 py-0.5 rounded cursor-default border border-[#facc15]/20">
              {playbackRate}x
            </div>
          )}
          
          <div className="flex items-center gap-2 w-24 group/vol">
            <button 
              onClick={() => setVolume(volume === 0 ? 1 : 0)}
              className="text-white/40 hover:text-white transition-colors focus:outline-none p-1"
            >
              {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <Slider.Root
              className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
              value={[volume]}
              max={1}
              step={0.05}
              onValueChange={handleVolumeChange}
            >
              <Slider.Track className="bg-white/10 relative grow h-[3px] rounded-full overflow-hidden transition-all group-hover/vol:h-[5px]">
                <Slider.Range className="absolute bg-white/60 h-full" />
              </Slider.Track>
              <Slider.Thumb className="block w-2.5 h-2.5 bg-white shadow-md rounded-full opacity-0 scale-50 group-hover/vol:opacity-100 group-hover/vol:scale-100 transition-all duration-200 focus:outline-none" />
            </Slider.Root>
          </div>
        </div>

      </div>
    </div>
  );
};
