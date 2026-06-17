import { create } from 'zustand';

interface VideoStore {
  videoFile: File | null;
  videoUrl: string | null;
  videoPath: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  seekToTime: number | null;
  
  setVideo: (file: File | null, url: string | null, path: string | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setSeekToTime: (time: number | null) => void;
  reset: () => void;
}

export const useVideoStore = create<VideoStore>((set) => ({
  videoFile: null,
  videoUrl: null,
  videoPath: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  seekToTime: null,

  setVideo: (file, url, path) => set({ videoFile: file, videoUrl: url, videoPath: path, currentTime: 0, isPlaying: false, seekToTime: null }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setSeekToTime: (seekToTime) => set({ seekToTime }),
  reset: () => set({ videoFile: null, videoUrl: null, videoPath: null, isPlaying: false, currentTime: 0, duration: 0, seekToTime: null }),
}));
