import { create } from 'zustand';
import { ProjectState, STTResult, STTStatus, TranslationStatus } from '../types/app_types';

export type { STTResult, STTStatus, TranslationStatus };

interface STTJobStore {
  status: STTStatus;
  errorMessage: string | null;
  progress: number;
  translationStatus: TranslationStatus;
  translationProgress: number;
  results: STTResult[];
  _buffer: STTResult[];
  
  setStatus: (status: STTStatus, progress?: number, errorMessage?: string | null) => void;
  setTranslationStatus: (status: TranslationStatus, progress?: number) => void;
  setResults: (results: STTResult[]) => void;
  syncJobState: (snapshot: any) => void;
  appendCues: (cues: any[]) => void;
  syncAppState: (state: ProjectState) => void;
  reset: () => void;
}

export const useSTTJobStore = create<STTJobStore>((set) => ({
  status: 'idle',
  errorMessage: null,
  progress: 0,
  translationStatus: 'idle',
  translationProgress: 0,
  results: [],
  _buffer: [],

  setStatus: (status, progress = 0, errorMessage = null) => set({ status, progress, errorMessage }),
  setTranslationStatus: (translationStatus, translationProgress = 0) => set({ translationStatus, translationProgress }),
  setResults: (results) => set({ results }),
  
  syncJobState: (snapshot: any) => set(() => {
    // We only update transient job state here, language might be in settings,
    // but the snapshot language represents the detected language for this job.
    return {
      status: snapshot.status,
      errorMessage: snapshot.error_message || null,
      progress: snapshot.progress || 0,
    };
  }),
  
  appendCues: (cues: any[]) => set((state) => ({ 
    results: [...state.results, ...cues] 
  })),
  
  syncAppState: (state: ProjectState) => set({
    translationStatus: state.translation_status,
    translationProgress: state.translation_progress,
  }),
  
  reset: () => set({ 
    status: 'idle', 
    errorMessage: null,
    progress: 0, 
    translationStatus: 'idle',
    translationProgress: 0,
    results: [], 
  }),
}));

// Selectors for derived state
export const selectIsProcessing = (state: STTJobStore) => 
  ['starting', 'loading_model', 'transcribing', 'cancelling'].includes(state.status);

export const selectCanTranslate = (state: STTJobStore) => 
  state.status === 'completed';

export const selectHasError = (state: STTJobStore) =>
  state.status === 'error' || state.status === 'failed';
