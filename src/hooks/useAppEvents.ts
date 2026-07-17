import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSTTStore } from "../store/sttStore";
import { ProjectState } from "../types/app_types";

export const useAppEvents = () => {
  useEffect(() => {
    let unlistenSettings: () => void;
    let unlistenState: () => void;

    const setupListeners = async () => {
      unlistenSettings = await listen("setting-changed", (event: any) => {
        const { key, value } = event.payload;
        const store = useSTTStore.getState() as any;
        const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        if (typeof store[setterName] === 'function') {
          store[setterName](value);
        }
      });

      unlistenState = await listen("app-state-changed", async () => {
        try {
          const prevState = useSTTStore.getState().status;
          const state = await invoke<ProjectState>("get_app_state");
          if (state) {
            useSTTStore.getState().syncAppState(state);

            if (prevState !== 'completed' && state.stt_status === 'completed') {
              import("../store/notifyStore").then(({ useNotifyStore }) => {
                useNotifyStore.getState().show("STT processing completed", "success");
              });
              
              if (useSTTStore.getState().enableTranslation) {
                import("../services/translationService").then(({ TranslationService }) => {
                  TranslationService.startTranslation();
                });
              }
            }
          }
        } catch (e) {
          console.error("Failed to sync app state:", e);
        }
      });
    };

    setupListeners();

    return () => {
      if (unlistenSettings) unlistenSettings();
      if (unlistenState) unlistenState();
    };
  }, []);
};
