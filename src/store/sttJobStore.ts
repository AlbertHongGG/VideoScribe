import { create } from 'zustand';
import { ProjectState, STTResult, PipelineTask, TaskStatus, TaskType } from '../types/bindings';

export type { STTResult, PipelineTask, TaskStatus, TaskType };

interface STTJobStore {
  tasks: PipelineTask[];
  results: STTResult[];
  vocalsAudioPath: string | null;
  backgroundAudioPath: string | null;
  
  setResults: (results: STTResult[]) => void;
  appendCues: (cues: any[]) => void;
  syncAppState: (state: ProjectState) => void;
  reset: () => void;
}

export const useSTTJobStore = create<STTJobStore>((set) => ({
  tasks: [],
  results: [],
  vocalsAudioPath: null,
  backgroundAudioPath: null,

  setResults: (results) => set({ results }),
  
  appendCues: (cues: any[]) => set((state) => ({ 
    results: [...state.results, ...cues] 
  })),
  
  syncAppState: (state: ProjectState) => set({
    tasks: state.tasks,
    vocalsAudioPath: state.vocals_audio_path || null,
    backgroundAudioPath: state.background_audio_path || null,
  }),
  
  reset: () => set({ 
    tasks: [],
    results: [], 
    vocalsAudioPath: null,
    backgroundAudioPath: null,
  }),
}));

// Selectors for derived state
export const selectIsProcessing = (state: STTJobStore) => {
  return state.tasks.some(t => t.status === 'running' || t.status === 'pending');
};

export const selectCanTranslate = (state: STTJobStore) => {
  const sttTask = state.tasks.find(t => t.task_type === 'stt');
  return sttTask?.status === 'completed';
};

export const selectHasError = (state: STTJobStore) => {
  return state.tasks.some(t => t.status === 'error');
};
