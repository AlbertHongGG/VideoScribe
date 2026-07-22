import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { useSTTJobStore, STTResult } from '../store/sttJobStore';
import { ProjectState } from '../types/bindings';
import { useNotifyStore } from '../store/notifyStore';

export class SubtitleIOService {
  static async exportSubtitles() {
    const { results } = useSTTJobStore.getState();
    const { show } = useNotifyStore.getState();

    if (!results || results.length === 0) {
      show("No subtitles to export", "warning");
      return;
    }

    try {
      const filePath = await save({
        filters: [{
          name: 'VideoScribe Subtitles',
          extensions: ['json']
        }],
        defaultPath: 'subtitles.json',
      });

      if (!filePath) {
        // User cancelled
        return;
      }

      const content = JSON.stringify(results, null, 2);
      await writeTextFile(filePath, content);

      show("Subtitles exported successfully", "success");
    } catch (err: any) {
      console.error("Failed to export subtitles:", err);
      show(`Export failed: ${err.message || 'Unknown error'}`, "error");
    }
  }

  static async importSubtitles() {
    const { syncAppState } = useSTTJobStore.getState();
    const { show } = useNotifyStore.getState();

    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'VideoScribe Subtitles',
          extensions: ['json']
        }]
      });

      if (!selected) {
        // User cancelled
        return;
      }

      const filePath = Array.isArray(selected) ? selected[0] : selected;
      const content = await readTextFile(filePath.path || filePath as string);

      const parsed = JSON.parse(content);

      // Basic validation
      if (!Array.isArray(parsed)) {
        throw new Error("Invalid file format: Root is not an array");
      }

      if (parsed.length > 0 && (!('start' in parsed[0]) || !('end' in parsed[0]) || !('text' in parsed[0]))) {
        throw new Error("Invalid file format: Missing required subtitle fields");
      }

      const results = parsed as STTResult[];
      // Update backend state first
      await invoke('import_stt_results', { results });
      
      // Then fetch and sync frontend state
      const newState = await invoke<ProjectState>('get_app_state');
      syncAppState(newState);

      show("Subtitles imported successfully", "success");
    } catch (err: any) {
      console.error("Failed to import subtitles:", err);
      show(`Import failed: ${err.message || 'Unknown error'}`, "error");
    }
  }
}
