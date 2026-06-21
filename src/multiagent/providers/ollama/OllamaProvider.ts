import { AIProvider } from '../AIProvider';
import { GenerateRequest, GenerateResponse } from '../../types';
import { fetch } from '@tauri-apps/plugin-http';

export class OllamaProvider implements AIProvider {
  public readonly name = 'ollama';
  private endpoint: string;

  constructor(public readonly model: string, baseUrl: string = 'http://localhost:11434') {
    this.endpoint = `${baseUrl.replace(/\/$/, '')}/api/generate`;
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const payload = {
      model: this.model,
      prompt: request.prompt,
      system: request.systemPrompt,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens,
      }
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;

      return {
        text: data.response,
        metadata: {
          provider: this.name,
          model: this.model,
          raw_response: data,
        },
      };
    } catch (error) {
      console.error('Ollama Provider Error:', error);
      throw error;
    }
  }
}
