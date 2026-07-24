import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSTTSettingsStore } from "../store/sttSettingsStore";
import { useSTTJobStore } from "../store/sttJobStore";
import { ProjectState } from "../types/bindings";

export const useAppEvents = () => {
  useEffect(() => {
    let unlistenFunctions: (() => void)[] = [];
    let isMounted = true;

    const setupListeners = async () => {
      try {
        const initialState = await invoke<ProjectState>("get_app_state");
        if (initialState) {
          useSTTJobStore.getState().syncAppState(initialState);
          useSTTSettingsStore.getState().setTargetLanguage(initialState.target_language);
        }
      } catch (e) {
        console.error("Failed to fetch initial app state:", e);
      }

      const u1 = await listen("setting-changed", (event: any) => {
        const { key, value } = event.payload;
        const store = useSTTSettingsStore.getState() as any;
        const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        if (typeof store[setterName] === 'function') {
          store[setterName](value);
        }
      });
      if (isMounted) unlistenFunctions.push(u1); else u1();

      const u2 = await listen("app-state-changed", async () => {
        try {
          const prevState = useSTTJobStore.getState().tasks;
          const state = await invoke<ProjectState>("get_app_state");
          if (state) {
            useSTTJobStore.getState().syncAppState(state);
            useSTTSettingsStore.getState().setTargetLanguage(state.target_language);
            
            // Check for STT completion notification
            const wasSttCompleted = prevState.find(t => t.task_type === 'stt')?.status === 'completed';
            const isSttCompleted = state.tasks.find(t => t.task_type === 'stt')?.status === 'completed';
            
            if (!wasSttCompleted && isSttCompleted) {
              import("../store/notifyStore").then(({ useNotifyStore }) => {
                useNotifyStore.getState().show("STT processing completed", "success");
              });
            }
          }
        } catch (e) {
          console.error("Failed to sync app state:", e);
        }
      });
      if (isMounted) unlistenFunctions.push(u2); else u2();

      const u4 = await listen("stt_segment_batch", (event: any) => {
        if (event.payload && event.payload.cues) {
          const formattedCues = event.payload.cues.map((cue: any) => ({
            start: cue.start_ms / 1000,
            end: cue.end_ms / 1000,
            text: cue.text,
            translation: null,
            words: cue.words || null,
          }));
          useSTTJobStore.getState().appendCues(formattedCues);
        }
      });
      if (isMounted) unlistenFunctions.push(u4); else u4();

      const u4_replace = await listen("stt_segment_replace_all", (event: any) => {
        if (event.payload && event.payload.cues) {
          const formattedCues = event.payload.cues.map((cue: any) => ({
            start: cue.start_ms / 1000,
            end: cue.end_ms / 1000,
            text: cue.text,
            translation: null,
            words: cue.words || null,
          }));
          useSTTJobStore.getState().setResults(formattedCues);
        }
      });
      if (isMounted) unlistenFunctions.push(u4_replace); else u4_replace();

      const u5 = await listen("stt_error", (event: any) => {
        const { message } = event.payload || event;
        import("../store/notifyStore").then(({ useNotifyStore }) => {
          useNotifyStore.getState().show(message || "An unknown error occurred", "error");
        });
      });
      if (isMounted) unlistenFunctions.push(u5); else u5();
    };

    setupListeners();

    return () => {
      isMounted = false;
      unlistenFunctions.forEach(unlisten => unlisten());
    };
  }, []);
};
