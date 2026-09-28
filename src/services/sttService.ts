import { commands } from "../types/bindings";
import { useSTTJobStore } from "../store/sttJobStore";
import { useSTTSettingsStore } from "../store/sttSettingsStore";
import { useNotifyStore } from "../store/notifyStore";

export class STTService {
  static async startSTT(videoPath: string, modelSize: string = "medium") {
    const notifyStore = useNotifyStore.getState();
    const settingsStore = useSTTSettingsStore.getState();

    notifyStore.show("Starting Speech-to-Text process...", "info");

    try {
      const triggerRes = await commands.triggerPipeline({
        videoPath, 
        sttEngine: settingsStore.sttEngine || "faster_whisper",
        modelSize, 
        language: settingsStore.language || "auto",
        vadEngine: settingsStore.vadEngine,
        mssEngine: settingsStore.mssEngine,
        mssModel: settingsStore.mssModel,
        faEngine: settingsStore.faEngine,
        faModel: settingsStore.faModel,
        useBatch: settingsStore.useBatch,
        batchSize: settingsStore.batchSize,
        enableProofread: settingsStore.enableProofread,
        enableSegmentation: settingsStore.enableSegmentation,
        enableTranslation: settingsStore.enableTranslation,
        targetLanguage: settingsStore.targetLanguage,
        enableRubyAnnotation: settingsStore.enableRubyAnnotation,
        enableFurigana: settingsStore.enableFurigana,
      });
      
      if (triggerRes.status === "error") throw new Error(triggerRes.error);
      

      // Reset frontend state only after successful trigger
      useSTTJobStore.getState().reset();
      
    } catch (e: any) {
      console.error(e);
      useNotifyStore.getState().show(`Failed to start STT: ${e.toString()}`, "error");
    }
  }
}
