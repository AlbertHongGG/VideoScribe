import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useSTTStore } from "../store/sttStore";
import { useNotifyStore } from "../store/notifyStore";

export class STTService {
  private static unlistenFn: UnlistenFn | null = null;
  private static updateInterval: number | null = null;

  static async startSTT(videoPath: string, modelSize: string = "medium") {
    const sttStore = useSTTStore.getState();
    const notifyStore = useNotifyStore.getState();

    sttStore.setLanguage(null);
    sttStore.setResults([]);
    sttStore.setStatus("loading_model", 0);
    notifyStore.show("Starting Speech-to-Text process...", "info");

    this.updateInterval = window.setInterval(() => {
      useSTTStore.getState().commitResults();
    }, 1000);

    try {
      if (this.unlistenFn) {
        this.unlistenFn();
        this.unlistenFn = null;
      }

      this.unlistenFn = await listen<string>("stt-progress", (event) => {
        try {
          const data = JSON.parse(event.payload);
          const currentStore = useSTTStore.getState();
          
          if (data.type === "progress") {
            currentStore.setStatus(data.status, data.progress);
            if (data.status === "completed") {
              this.cleanup();
              currentStore.commitResults();
              notifyStore.show("STT processing completed", "success");
            }
          } else if (data.type === "result") {
            currentStore.appendResultToBuffer({ start: data.start, end: data.end, text: data.text });
          } else if (data.type === "language") {
            currentStore.setLanguage(data.language);
          } else if (data.type === "error") {
            this.cleanup();
            currentStore.setStatus("error");
            notifyStore.show(data.message, "error");
          }
        } catch (e) {
          console.error("Failed to parse STT event", e);
        }
      });

      await invoke("run_stt", { videoPath, modelSize });

    } catch (e: any) {
      console.error(e);
      this.cleanup();
      useSTTStore.getState().setStatus("error");
      useNotifyStore.getState().show(`Failed to start STT: ${e.toString()}`, "error");
    }
  }

  private static cleanup() {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
    if (this.updateInterval !== null) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

