
import { useNotifyStore } from '../store/notifyStore';
import { commands } from '../types/bindings';
import { useSTTSettingsStore } from '../store/sttSettingsStore';

export class TranslationService {
  static async startTranslation() {
    const notifyStore = useNotifyStore.getState();
    const settingsStore = useSTTSettingsStore.getState();

    notifyStore.show("Starting Dual Subtitle Translation...", "info");

    try {
      await commands.startTranslation(settingsStore.targetLanguage);
    } catch (e: any) {
      console.error("Translation failed to start:", e);
      notifyStore.show(`Failed to start translation: ${e.toString()}`, "error");
    }
  }
}
