import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface STTSettingsStore {
  isPanelOpen: boolean;
  model: string;
  language: string | null;
  showSubtitles: boolean;
  enableDictionary: boolean;
  enableFurigana: boolean;
  enableTranslation: boolean;
  targetLanguage: string;
  vadEngine: string;
  useBatch: boolean;
  batchSize: number;
  subtitlePositionX: number;
  subtitlePositionY: number;
  subtitleSpacing: number;
  sttFontSize: number;
  translationFontSize: number;
  
  togglePanel: () => void;
  setPanelOpen: (isOpen: boolean) => void;
  setModel: (model: string) => void;
  setLanguage: (language: string | null) => void;
  setShowSubtitles: (show: boolean) => void;
  setEnableDictionary: (enable: boolean) => void;
  setEnableFurigana: (enable: boolean) => void;
  setEnableTranslation: (enable: boolean) => void;
  setTargetLanguage: (lang: string) => void;
  setVadEngine: (engine: string) => void;
  setUseBatch: (use: boolean) => void;
  setBatchSize: (size: number) => void;
  setSubtitlePositionX: (x: number) => void;
  setSubtitlePositionY: (y: number) => void;
  setSubtitleSpacing: (spacing: number) => void;
  setSttFontSize: (size: number) => void;
  setTranslationFontSize: (size: number) => void;
}

export const useSTTSettingsStore = create<STTSettingsStore>()(
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
      vadEngine: 'off',
      useBatch: false,
      batchSize: 16,
      subtitlePositionX: 50,
      subtitlePositionY: 90,
      subtitleSpacing: 6,
      sttFontSize: 20,
      translationFontSize: 18,

      togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
      setPanelOpen: (isOpen) => set({ isPanelOpen: isOpen }),
      setModel: (model) => set({ model }),
      setLanguage: (language) => set({ language }),
      setShowSubtitles: (showSubtitles) => set({ showSubtitles }),
      setEnableDictionary: (enable) => set({ enableDictionary: enable }),
      setEnableFurigana: (enable) => set({ enableFurigana: enable }),
      setEnableTranslation: (enable) => set({ enableTranslation: enable }),
      setTargetLanguage: (lang) => set({ targetLanguage: lang }),
      setVadEngine: (engine) => set({ vadEngine: engine }),
      setUseBatch: (useBatch) => set({ useBatch }),
      setBatchSize: (batchSize) => set({ batchSize }),
      setSubtitlePositionX: (x) => set({ subtitlePositionX: x }),
      setSubtitlePositionY: (y) => set({ subtitlePositionY: y }),
      setSubtitleSpacing: (spacing) => set({ subtitleSpacing: spacing }),
      setSttFontSize: (size) => set({ sttFontSize: size }),
      setTranslationFontSize: (size) => set({ translationFontSize: size }),
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
        vadEngine: state.vadEngine,
        useBatch: state.useBatch,
        batchSize: state.batchSize,
        subtitlePositionX: state.subtitlePositionX,
        subtitlePositionY: state.subtitlePositionY,
        subtitleSpacing: state.subtitleSpacing,
        sttFontSize: state.sttFontSize,
        translationFontSize: state.translationFontSize,
      }),
    }
  )
);
