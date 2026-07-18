import { invoke } from "@tauri-apps/api/core";
import { useSTTStore } from "../store/sttStore";
import { useNotifyStore } from "../store/notifyStore";

export class STTService {
  static async startSTT(videoPath: string, modelSize: string = "medium") {
    const notifyStore = useNotifyStore.getState();

    // Optimistically update frontend state while backend boots
    useSTTStore.getState().setStatus("loading_model", 0);
    notifyStore.show("Starting Speech-to-Text process...", "info");

    try {
      await invoke("run_stt", { videoPath, modelSize });
      
      // Explicitly trigger translation if enabled
      if (useSTTStore.getState().enableTranslation) {
        import("./translationService").then(({ TranslationService }) => {
          TranslationService.startTranslation();
        });
      }
      
    } catch (e: any) {
      console.error(e);
      useSTTStore.getState().setStatus("error");
      useNotifyStore.getState().show(`Failed to start STT: ${e.toString()}`, "error");
    }
  }
}
