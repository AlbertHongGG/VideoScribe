import { create } from 'zustand';

export interface STTResult {
  start: number;
  end: number;
  text: string;
}

type STTStatus = 'idle' | 'loading_model' | 'transcribing' | 'completed' | 'error';

interface STTStore {
  isPanelOpen: boolean;
  language: string | null;
  status: STTStatus;
  progress: number;
  results: STTResult[];
  _buffer: STTResult[];
  
  togglePanel: () => void;
  setPanelOpen: (isOpen: boolean) => void;
  setLanguage: (language: string | null) => void;
  setStatus: (status: STTStatus, progress?: number) => void;
  setResults: (results: STTResult[]) => void;
  appendResultToBuffer: (result: STTResult) => void;
  commitResults: () => void;
  reset: () => void;
}

export const useSTTStore = create<STTStore>((set) => ({
  isPanelOpen: false,
  language: null,
  status: 'idle',
  progress: 0,
  results: [],
  _buffer: [],

  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  setPanelOpen: (isOpen) => set({ isPanelOpen: isOpen }),
  setLanguage: (language) => set({ language }),
  setStatus: (status, progress = 0) => set({ status, progress }),
  setResults: (results) => set({ results, _buffer: [...results] }),
  
  // Appends to buffer without triggering a full re-render of results-dependent components immediately.
  // Note: Zustand still notifies subscribers of the store, but we isolate the 'results' array reference.
  appendResultToBuffer: (result) => set((state) => ({ _buffer: [...state._buffer, result] })),
  
  // Flushes buffer to the main results array, causing components relying on `results` to update.
  commitResults: () => set((state) => ({ results: [...state._buffer] })),
  
  reset: () => set({ status: 'idle', progress: 0, results: [], _buffer: [], language: null }),
}));
