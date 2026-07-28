import { create } from 'zustand';
import { ProjectState, STTResult, PipelineTask, TaskStatus, TaskType } from '../types/bindings';

export type { STTResult, PipelineTask, TaskStatus, TaskType };

interface STTJobStore {
  tasks: PipelineTask[];
  results: STTResult[];
  vocalsAudioPath: string | null;
  backgroundAudioPath: string | null;
  isOverlayVisible: boolean;
  
  setResults: (results: STTResult[]) => void;
  setOverlayVisible: (visible: boolean) => void;
  appendCues: (cues: any[]) => void;
  syncAppState: (state: ProjectState) => void;
  reset: () => void;
}

export const useSTTJobStore = create<STTJobStore>((set) => ({
  tasks: [],
  results: [],
  vocalsAudioPath: null,
  backgroundAudioPath: null,
  isOverlayVisible: false,

  setResults: (results) => set({ results }),
  setOverlayVisible: (visible) => set({ isOverlayVisible: visible }),
  
  appendCues: (cues: any[]) => set((state) => ({ 
    results: [...state.results, ...cues] 
  })),
  
  syncAppState: (state: ProjectState) => set({
    tasks: state.tasks,
    results: state.results,
    vocalsAudioPath: state.vocals_audio_path || null,
    backgroundAudioPath: state.background_audio_path || null,
  }),
  
  reset: () => set(() => ({ 
    tasks: [],
    results: [], 
    vocalsAudioPath: null,
    backgroundAudioPath: null,
    // explicitly NOT resetting isOverlayVisible because it's controlled independently
  })),
}));

// Selectors for derived state
export const selectIsProcessing = (state: STTJobStore) => {
  return state.tasks.some(t => t.status === 'running' || t.status === 'pending');
};

export const selectCanTranslate = (state: STTJobStore) => {
  if (state.results.length === 0) return false;
  const isProcessing = state.tasks.some(t => t.status === 'running' || t.status === 'pending');
  return !isProcessing;
};

export const selectHasError = (state: STTJobStore) => {
  return state.tasks.some(t => t.status === 'error');
};
