import { invoke } from "@tauri-apps/api/core";
import { useSTTJobStore } from "../store/sttJobStore";
import { useSTTSettingsStore } from "../store/sttSettingsStore";
import { useNotifyStore } from "../store/notifyStore";

export class STTService {
  static async startSTT(videoPath: string, modelSize: string = "medium") {
    const notifyStore = useNotifyStore.getState();

    // Optimistically update frontend state while backend boots
    useSTTJobStore.getState().reset();
    useSTTJobStore.getState().setStatus("loading_model", 0);
    notifyStore.show("Starting Speech-to-Text process...", "info");

    try {
      await invoke("start_stt_job", { videoPath, modelSize, language: "auto" });
      
      // Explicitly trigger translation if enabled
      if (useSTTSettingsStore.getState().enableTranslation) {
        import("./translationService").then(({ TranslationService }) => {
          TranslationService.startTranslation();
        });
      }
      
    } catch (e: any) {
      console.error(e);
      useSTTJobStore.getState().setStatus("error");
      useNotifyStore.getState().show(`Failed to start STT: ${e.toString()}`, "error");
    }
  }
}
