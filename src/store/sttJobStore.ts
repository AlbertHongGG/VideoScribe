import { create } from 'zustand';
import { ProjectState, STTResult, Job, TaskType, JobStatus, TaskStatus } from '../types/bindings';
import { invoke } from '@tauri-apps/api/core';

export type { STTResult, Job, TaskType, JobStatus, TaskStatus };

interface ActiveJobStore {
  currentJob: Job | null;
  results: STTResult[];
  extractedAudioPath: string | null;
  vocalsAudioPath: string | null;
  backgroundAudioPath: string | null;
  hasActiveStems: boolean;
  
  // Handlers for state syncing
  setResults: (results: STTResult[]) => void;
  appendCues: (cues: any[]) => void;
  syncAppState: (state: ProjectState) => void;
  syncCurrentJob: () => Promise<void>;
  reset: () => void;
}

export const useSTTJobStore = create<ActiveJobStore>((set, get) => ({
  currentJob: null,
  results: [],
  extractedAudioPath: null,
  vocalsAudioPath: null,
  backgroundAudioPath: null,
  hasActiveStems: false,

  setResults: (results) => set({ results }),
  
  appendCues: (cues: any[]) => set((state) => ({ 
    results: [...state.results, ...cues] 
  })),
  
  syncAppState: (state: ProjectState) => {
    set({
      results: [...state.results],
      extractedAudioPath: state.extracted_audio_path || null,
      vocalsAudioPath: state.vocals_audio_path || null,
      backgroundAudioPath: state.background_audio_path || null,
      hasActiveStems: Boolean(state.has_active_stems),
    });
    // Fire off async sync of current job
    get().syncCurrentJob();
  },

  syncCurrentJob: async () => {
    try {
      const job = await invoke<Job | null>('get_current_job');
      set({ currentJob: job });
    } catch (error) {
      console.error('Failed to sync current job:', error);
    }
  },
  
  reset: () => set(() => ({ 
    currentJob: null,
    results: [], 
    extractedAudioPath: null,
    vocalsAudioPath: null,
    backgroundAudioPath: null,
    hasActiveStems: false,
  })),
}));

// Selectors for derived state
export const selectIsProcessing = (state: ActiveJobStore) => {
  if (!state.currentJob) return false;
  return state.currentJob.status === 'pending' || state.currentJob.status === 'running';
};

export const selectCanTranslate = (state: ActiveJobStore) => {
  if (state.results.length === 0) return false;
  return !selectIsProcessing(state);
};

export const selectHasError = (state: ActiveJobStore) => {
  if (!state.currentJob) return false;
  return state.currentJob.status === 'error';
};

export const selectIsOverlayVisible = (state: ActiveJobStore) => {
  return state.currentJob !== null && !state.currentJob.is_dismissed;
};

