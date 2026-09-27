import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PlayerPreferencesStore {
  enableTimelineHoverPreview: boolean;
  setEnableTimelineHoverPreview: (enable: boolean) => void;
}

export const usePlayerPreferencesStore = create<PlayerPreferencesStore>()(
  persist(
    (set) => ({
      enableTimelineHoverPreview: true,
      setEnableTimelineHoverPreview: (enable: boolean) =>
        set({ enableTimelineHoverPreview: enable }),
    }),
    {
      name: "player-preferences",
    }
  )
);
