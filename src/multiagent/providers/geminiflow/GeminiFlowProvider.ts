import { AIProvider } from '../AIProvider';
import { GenerateRequest, GenerateResponse } from '../../types';
import { GeminiFlowClient } from './sdk/client';

export class GeminiFlowProvider implements AIProvider {
  public readonly name = 'geminiflow';
  private client: GeminiFlowClient;

  constructor(
    private model: string,
    baseUrl: string = 'http://127.0.0.1:8000'
  ) {
    this.client = new GeminiFlowClient(baseUrl);
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const response = await this.client.chat(
        request.prompt,
        request.systemPrompt,
        this.model,
        'zh-TW', // Default language, or could be passed via request metadata
        request.images,
        request.sessionId,
        false // Usually, API chat might save images by default. Here we let the provider decide, or default to false to save space.
      );

      return {
        text: response.text,
        metadata: {
          provider: this.name,
          model: this.model,
          images: response.images,
        }
      };
    } catch (error) {
      console.error('GeminiFlow Provider Error:', error);
      throw error;
    }
  }
}
