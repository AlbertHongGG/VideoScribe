import { useSTTStore, STTResult } from '../store/sttStore';
import { useNotifyStore } from '../store/notifyStore';
import { commands } from '../types/bindings';

export interface SubtitleSegment {
  id: number;
  text: string;
}

export interface TranslationResult {
  id: number;
  translation: string;
}

export class TranslationService {
  static async startTranslation() {
    const sttStore = useSTTStore.getState();
    const notifyStore = useNotifyStore.getState();

    if (!sttStore.enableTranslation) {
      return; // Translation not enabled
    }

    const results = [...sttStore.results];
    if (results.length === 0) {
      return;
    }

    sttStore.setTranslationStatus('translating', 0);
    notifyStore.show("Starting Dual Subtitle Translation...", "info");

    try {
      // Backend Agent will be invoked via Tauri command
      
      const targetLanguage = sttStore.targetLanguage;
      
      // Generate a unique session ID for this entire translation task
      const sessionId = crypto.randomUUID();
      
      // We will translate in chunks of 15 sentences to give LLM enough context without overflowing.
      const CHUNK_SIZE = 15;
      const chunks: STTResult[][] = [];
      
      for (let i = 0; i < results.length; i += CHUNK_SIZE) {
        chunks.push(results.slice(i, i + CHUNK_SIZE));
      }

      let previousContext = '';
      const translatedResults: STTResult[] = [...results];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Map to TranslatorAgent segment format. We use the original index as the ID.
        const startIndex = i * CHUNK_SIZE;
        const segments: SubtitleSegment[] = chunk.map((r, idx) => ({
          id: startIndex + idx,
          text: r.text
        }));

        try {
          const response = await commands.runAgentTask("TranslatorAgent", JSON.stringify({
            segments,
            targetLanguage,
            previousContext,
            sessionId
          }));

          if (response.status === 'error') {
            throw new Error(response.error);
          }

          const translations = JSON.parse(response.data) as TranslationResult[];
          
          // Map back to our main results array
          for (const t of translations) {
            if (translatedResults[t.id]) {
              translatedResults[t.id].translation = t.translation;
            }
          }

          // Update progress
          const progress = Math.round(((i + 1) / chunks.length) * 100);
          useSTTStore.getState().setTranslationStatus('translating', progress);
          
          // Set previousContext for the next chunk (last 3 sentences of current chunk)
          const lastFew = chunk.slice(-3).map(r => r.text).join(' ');
          previousContext = lastFew;
          
        } catch (chunkError: any) {
          console.error(`Failed to translate chunk ${i}:`, chunkError);
          // We don't abort completely. We just leave this chunk untranslated.
          const errorMsg = chunkError instanceof Error ? chunkError.message : String(chunkError);
          notifyStore.show(`Warning: Failed to translate part of the subtitles. ${errorMsg}`, "warning");
        }
      }

      // Update store with final translated results
      useSTTStore.getState().setResults(translatedResults);
      useSTTStore.getState().setTranslationStatus('completed', 100);
      notifyStore.show("Translation completed successfully!", "success");

    } catch (e: any) {
      console.error("Translation failed:", e);
      useSTTStore.getState().setTranslationStatus('error');
      notifyStore.show(`Failed to translate subtitles: ${e.toString()}`, "error");
    }
  }
}
