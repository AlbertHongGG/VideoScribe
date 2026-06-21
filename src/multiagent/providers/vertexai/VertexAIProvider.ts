import { AIProvider } from '../AIProvider';
import { GenerateRequest, GenerateResponse } from '../../types';
import { fetch } from '@tauri-apps/plugin-http';

export class VertexAIProvider implements AIProvider {
  public readonly name = 'VertexAI';

  constructor(
    private model: string,
    private projectId: string,
    private region: string,
    private accessToken: string
  ) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const baseUrl = this.region === 'global' ? 'aiplatform.googleapis.com' : `${this.region}-aiplatform.googleapis.com`;
    const url = `https://${baseUrl}/v1/projects/${this.projectId}/locations/${this.region}/publishers/google/models/${this.model}:generateContent`;

    const payload: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: request.prompt }]
        }
      ],
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxTokens ?? 3000,
      }
    };

    if (request.systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: request.systemPrompt }]
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json() as any;
    
    // Extract text from the first candidate
    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('Unexpected Vertex AI response format: missing content parts.');
    }

    const text = candidate.content.parts[0].text || '';
    
    // Extract token usage
    const usageMetadata = data.usageMetadata || {};

    return {
      text,
      usage: {
        promptTokens: usageMetadata.promptTokenCount || 0,
        completionTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
      },
      metadata: {
        provider: this.name,
        model: this.model,
        projectId: this.projectId,
        region: this.region
      }
    };
  }
}
