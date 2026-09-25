import { useNotifyStore } from '../store/notifyStore';
import { commands } from '../types/bindings';

export class RubyAnnotationService {
  static async startRubyAnnotation() {
    const notifyStore = useNotifyStore.getState();

    notifyStore.show("Starting AI Furigana Semantic Correction...", "info");

    try {
      await commands.startRubyAnnotation();
    } catch (e: any) {
      console.error("Ruby annotation failed to start:", e);
      notifyStore.show(`Failed to start ruby annotation: ${e.toString()}`, "error");
    }
  }
}
