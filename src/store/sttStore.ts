import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectState, STTResult, STTStatus, TranslationStatus } from '../types/app_types';

export type { STTResult, STTStatus, TranslationStatus };

interface STTStore {
  isPanelOpen: boolean;
  model: string;
  language: string | null;
  showSubtitles: boolean;
  enableDictionary: boolean;
  enableFurigana: boolean;
  enableTranslation: boolean;
  targetLanguage: string;
  subtitlePositionX: number;
  subtitlePositionY: number;
  subtitleSpacing: number;
  sttFontSize: number;
  translationFontSize: number;
  status: STTStatus;
  errorMessage: string | null;
  progress: number;
  translationStatus: TranslationStatus;
  translationProgress: number;
  results: STTResult[];
  _buffer: STTResult[];
  
  togglePanel: () => void;
  setPanelOpen: (isOpen: boolean) => void;
  setModel: (model: string) => void;
  setLanguage: (language: string | null) => void;
  setShowSubtitles: (show: boolean) => void;
  setEnableDictionary: (enable: boolean) => void;
  setEnableFurigana: (enable: boolean) => void;
  setEnableTranslation: (enable: boolean) => void;
  setTargetLanguage: (lang: string) => void;
  setSubtitlePositionX: (x: number) => void;
  setSubtitlePositionY: (y: number) => void;
  setSubtitleSpacing: (spacing: number) => void;
  setSttFontSize: (size: number) => void;
  setTranslationFontSize: (size: number) => void;
  setStatus: (status: STTStatus, progress?: number, errorMessage?: string | null) => void;
  setTranslationStatus: (status: TranslationStatus, progress?: number) => void;
  setResults: (results: STTResult[]) => void;
  syncAppState: (state: ProjectState) => void;
  reset: () => void;
}

export const useSTTStore = create<STTStore>()(
  persist(
    (set) => ({
      isPanelOpen: false,
      model: 'medium',
      language: 'auto',
      showSubtitles: true,
      enableDictionary: false,
      enableFurigana: false,
  enableTranslation: false,
  targetLanguage: 'zh-TW',
  subtitlePositionX: 50,
  subtitlePositionY: 90,
  subtitleSpacing: 6,
  sttFontSize: 20,
  translationFontSize: 18,
  status: 'idle',
  errorMessage: null,
  progress: 0,
  translationStatus: 'idle',
  translationProgress: 0,
  results: [],
  _buffer: [],

      togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
      setPanelOpen: (isOpen) => set({ isPanelOpen: isOpen }),
      setModel: (model) => set({ model }),
      setLanguage: (language) => set({ language }),
      setShowSubtitles: (showSubtitles) => set({ showSubtitles }),
      setEnableDictionary: (enable) => set({ enableDictionary: enable }),
      setEnableFurigana: (enable) => set({ enableFurigana: enable }),
  setEnableTranslation: (enable) => set({ enableTranslation: enable }),
  setTargetLanguage: (lang) => set({ targetLanguage: lang }),
  setSubtitlePositionX: (x) => set({ subtitlePositionX: x }),
  setSubtitlePositionY: (y) => set({ subtitlePositionY: y }),
  setSubtitleSpacing: (spacing) => set({ subtitleSpacing: spacing }),
  setSttFontSize: (size) => set({ sttFontSize: size }),
  setTranslationFontSize: (size) => set({ translationFontSize: size }),
  setStatus: (status, progress = 0, errorMessage = null) => set({ status, progress, errorMessage }),
  setTranslationStatus: (translationStatus, translationProgress = 0) => set({ translationStatus, translationProgress }),
  setResults: (results) => set({ results }),
  
  syncAppState: (state) => set({
    status: state.stt_status,
    errorMessage: state.stt_error_message,
    progress: state.stt_progress,
    translationStatus: state.translation_status,
    translationProgress: state.translation_progress,
    results: state.results,
    targetLanguage: state.target_language,
  }),
  
      reset: () => set({ 
        status: 'idle', 
        errorMessage: null,
        progress: 0, 
        translationStatus: 'idle',
        translationProgress: 0,
        results: [], 
      }),
    }),
    {
      name: 'stt-settings',
      partialize: (state) => ({
        model: state.model,
        language: state.language,
        showSubtitles: state.showSubtitles,
        enableDictionary: state.enableDictionary,
        enableFurigana: state.enableFurigana,
        enableTranslation: state.enableTranslation,
        targetLanguage: state.targetLanguage,
        subtitlePositionX: state.subtitlePositionX,
        subtitlePositionY: state.subtitlePositionY,
        subtitleSpacing: state.subtitleSpacing,
        sttFontSize: state.sttFontSize,
        translationFontSize: state.translationFontSize,
      }),
    }
  )
);
