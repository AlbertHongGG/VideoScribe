import { useNotifyStore } from '../store/notifyStore';
import { commands } from '../types/bindings';

export class ProofreadService {
  static async startProofread() {
    const notifyStore = useNotifyStore.getState();

    notifyStore.show("Starting AI Speech Proofreading...", "info");

    try {
      const res = await commands.startProofread();
      if (res.status === "error") throw new Error(res.error);
    } catch (e: any) {
      console.error("Proofreading failed to start:", e);
      notifyStore.show(`Failed to start proofreading: ${e.toString()}`, "error");
    }
  }
}
