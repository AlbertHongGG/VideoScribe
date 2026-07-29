import { useVideoStore } from '../store/videoStore';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';

export class VideoLoaderService {
  /**
   * Loads a video from a given absolute path, converts it to a browser-compatible
   * source URL using Tauri, and updates the global video store.
   */
  static loadVideoFromPath(path: string) {
    try {
      const ext = path.split('.').pop()?.toLowerCase();
      if (ext === 'mp4' || ext === 'mkv' || ext === 'webm') {
        const url = convertFileSrc(path);
        const fileName = path.split('\\').pop() || path.split('/').pop() || "video";
        // Create a mock File object to satisfy the store API
        const mockFile = new File([], fileName);
        
        useVideoStore.getState().setVideo(mockFile, url, path);
        invoke("set_video_path", { path }).catch(console.error);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to load video from path:", e);
      return false;
    }
  }
}
