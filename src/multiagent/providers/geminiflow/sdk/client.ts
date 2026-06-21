import { fetch } from '@tauri-apps/plugin-http';
import { GeminiFlowChatPayload, GeminiFlowChatResponse, GeminiFlowStreamData } from './types';

export class GeminiFlowClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://127.0.0.1:8000") {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async health(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  }

  async chat(
    prompt: string,
    systemPrompt?: string,
    model: string = "gemini-3-pro",
    language: string = "zh-TW",
    images?: string[],
    sessionId?: string,
    saveImages: boolean = true
  ): Promise<GeminiFlowChatResponse> {
    const payload: GeminiFlowChatPayload = {
      prompt,
      model,
      language,
      save_images: saveImages,
    };
    if (systemPrompt) payload.system_prompt = systemPrompt;
    if (images && images.length > 0) payload.images = images;
    if (sessionId) payload.session_id = sessionId;

    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response.json();
  }

  // Uses fetch to process Server-Sent Events (SSE) stream
  async *stream(
    prompt: string,
    systemPrompt?: string,
    model: string = "gemini-3-pro",
    language: string = "zh-TW",
    images?: string[],
    sessionId?: string,
    saveImages: boolean = true
  ): AsyncGenerator<GeminiFlowStreamData, void, unknown> {
    const payload: GeminiFlowChatPayload = {
      prompt,
      model,
      language,
      save_images: saveImages,
    };
    if (systemPrompt) payload.system_prompt = systemPrompt;
    if (images && images.length > 0) payload.images = images;
    if (sessionId) payload.session_id = sessionId;

    const response = await fetch(`${this.baseUrl}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Stream failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is missing.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("event:")) continue;
        if (trimmed.startsWith("data:")) {
          const dataStr = trimmed.substring(5).trim();
          try {
            const data: GeminiFlowStreamData = JSON.parse(dataStr);
            yield data;
          } catch (e) {
            // ignore JSON parse error
          }
        }
      }
    }
  }
}
