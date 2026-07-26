import { useNotifyStore } from '../store/notifyStore';
import { commands } from '../types/bindings';

export class SegmentationService {
  static async startSegmentation() {
    const notifyStore = useNotifyStore.getState();

    notifyStore.show("Starting AI Segmentation...", "info");

    try {
      await commands.startSegmentation();
    } catch (e: any) {
      console.error("Segmentation failed to start:", e);
      notifyStore.show(`Failed to start segmentation: ${e.toString()}`, "error");
    }
  }
}
