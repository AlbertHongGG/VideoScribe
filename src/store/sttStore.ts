import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface STTResult {
  start: number;
  end: number;
  text: string;
  translation?: string;
}

type STTStatus = 'idle' | 'loading_model' | 'transcribing' | 'completed' | 'error';
type TranslationStatus = 'idle' | 'translating' | 'completed' | 'error';

interface STTStore {
  isPanelOpen: boolean;
  model: string;
  language: string | null;
  showSubtitles: boolean;
  enableDictionary: boolean;
  enableTranslation: boolean;
  targetLanguage: string;
  subtitlePositionX: number;
  subtitlePositionY: number;
  subtitleSpacing: number;
  sttFontSize: number;
  translationFontSize: number;
  status: STTStatus;
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
  setEnableTranslation: (enable: boolean) => void;
  setTargetLanguage: (lang: string) => void;
  setSubtitlePositionX: (x: number) => void;
  setSubtitlePositionY: (y: number) => void;
  setSubtitleSpacing: (spacing: number) => void;
  setSttFontSize: (size: number) => void;
  setTranslationFontSize: (size: number) => void;
  setStatus: (status: STTStatus, progress?: number) => void;
  setTranslationStatus: (status: TranslationStatus, progress?: number) => void;
  setResults: (results: STTResult[]) => void;
  appendResultToBuffer: (result: STTResult) => void;
  commitResults: () => void;
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
  enableTranslation: false,
  targetLanguage: 'zh-TW',
  subtitlePositionX: 50,
  subtitlePositionY: 90,
  subtitleSpacing: 6,
  sttFontSize: 20,
  translationFontSize: 18,
  status: 'idle',
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
  setEnableTranslation: (enable) => set({ enableTranslation: enable }),
  setTargetLanguage: (lang) => set({ targetLanguage: lang }),
  setSubtitlePositionX: (x) => set({ subtitlePositionX: x }),
  setSubtitlePositionY: (y) => set({ subtitlePositionY: y }),
  setSubtitleSpacing: (spacing) => set({ subtitleSpacing: spacing }),
  setSttFontSize: (size) => set({ sttFontSize: size }),
  setTranslationFontSize: (size) => set({ translationFontSize: size }),
  setStatus: (status, progress = 0) => set({ status, progress }),
  setTranslationStatus: (translationStatus, translationProgress = 0) => set({ translationStatus, translationProgress }),
  setResults: (results) => set({ results, _buffer: [...results] }),
  
  // Appends to buffer without triggering a full re-render of results-dependent components immediately.
  // Note: Zustand still notifies subscribers of the store, but we isolate the 'results' array reference.
  appendResultToBuffer: (result) => set((state) => ({ _buffer: [...state._buffer, result] })),
  
  // Flushes buffer to the main results array, causing components relying on `results` to update.
  commitResults: () => set((state) => ({ results: [...state._buffer] })),
  
      reset: () => set({ 
        status: 'idle', 
        progress: 0, 
        translationStatus: 'idle',
        translationProgress: 0,
        results: [], 
        _buffer: [], 
      }),
    }),
    {
      name: 'stt-settings',
      partialize: (state) => ({
        model: state.model,
        language: state.language,
        showSubtitles: state.showSubtitles,
        enableDictionary: state.enableDictionary,
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
