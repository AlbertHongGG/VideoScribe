import { useSTTStore } from '../store/sttStore';
import { useNotifyStore } from '../store/notifyStore';
import { commands } from '../types/bindings';

export class TranslationService {
  static async startTranslation() {
    const sttStore = useSTTStore.getState();
    const notifyStore = useNotifyStore.getState();

    notifyStore.show("Starting Dual Subtitle Translation...", "info");

    try {
      await commands.startTranslation();
    } catch (e: any) {
      console.error("Translation failed to start:", e);
      notifyStore.show(`Failed to start translation: ${e.toString()}`, "error");
    }
  }
}
