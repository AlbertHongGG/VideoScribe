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
  vocalsAudioPath: string | null;
  backgroundAudioPath: string | null;
  
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
  vocalsAudioPath: null,
  backgroundAudioPath: null,

  setStatus: (status, progress = 0, errorMessage = null) => set({ status, progress, errorMessage }),
  setTranslationStatus: (translationStatus, translationProgress = 0) => set({ translationStatus, translationProgress }),
  setResults: (results) => set({ results }),
  
  syncJobState: (snapshot: any) => set((state) => ({
    status: snapshot.status,
    errorMessage: snapshot.error_message || null,
    progress: snapshot.progress || 0,
    vocalsAudioPath: snapshot.vocals_path !== undefined ? snapshot.vocals_path : state.vocalsAudioPath,
    backgroundAudioPath: snapshot.instrumental_path !== undefined ? snapshot.instrumental_path : state.backgroundAudioPath,
  })),
  
  appendCues: (cues: any[]) => set((state) => ({ 
    results: [...state.results, ...cues] 
  })),
  
  syncAppState: (state: ProjectState) => set({
    translationStatus: state.translation_status,
    translationProgress: state.translation_progress,
    vocalsAudioPath: state.vocals_audio_path || null,
    backgroundAudioPath: state.background_audio_path || null,
  }),
  
  reset: () => set({ 
    status: 'idle', 
    errorMessage: null,
    progress: 0, 
    translationStatus: 'idle',
    translationProgress: 0,
    results: [], 
    vocalsAudioPath: null,
    backgroundAudioPath: null,
  }),
}));

// Selectors for derived state
export const selectIsProcessing = (state: STTJobStore) => 
  ['loading_model', 'transcribing'].includes(state.status);

export const selectCanTranslate = (state: STTJobStore) => 
  state.status === 'completed';

export const selectHasError = (state: STTJobStore) =>
  state.status === 'error';
