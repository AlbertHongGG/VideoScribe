import { invoke } from "@tauri-apps/api/core";
import { useSTTJobStore } from "../store/sttJobStore";
import { useSTTSettingsStore } from "../store/sttSettingsStore";
import { useNotifyStore } from "../store/notifyStore";

export class STTService {
  static async startSTT(videoPath: string, modelSize: string = "medium") {
    const notifyStore = useNotifyStore.getState();
    const settingsStore = useSTTSettingsStore.getState();

    // Optimistically update frontend state while backend boots
    useSTTJobStore.getState().reset();
    notifyStore.show("Starting Speech-to-Text process...", "info");

    try {
      await invoke("start_stt_job", { 
        videoPath, 
        modelSize, 
        language: settingsStore.language || "auto",
        vadEngine: settingsStore.vadEngine,
        mssEngine: settingsStore.mssEngine,
        mssModel: settingsStore.mssModel,
        useBatch: settingsStore.useBatch,
        batchSize: settingsStore.batchSize,
        enableTranslation: settingsStore.enableTranslation
      });
      
      // Explicitly trigger translation if enabled
      if (useSTTSettingsStore.getState().enableTranslation) {
        import("./translationService").then(({ TranslationService }) => {
          TranslationService.startTranslation();
        });
      }
      
    } catch (e: any) {
      console.error(e);
      useNotifyStore.getState().show(`Failed to start STT: ${e.toString()}`, "error");
    }
  }
}
