import { AIProvider } from './AIProvider';
import { OllamaProvider } from './ollama/OllamaProvider';
import { VertexAIProvider } from './vertexai/VertexAIProvider';
import { GeminiFlowProvider } from './geminiflow/GeminiFlowProvider';

export class ProviderFactory {
  static createProvider(agentName: string): AIProvider {
    // For example: agentName = 'translator' -> VITE_AGENT_TRANSLATOR_PROVIDER
    const envPrefix = `VITE_AGENT_${agentName.toUpperCase()}_`;
    
    // Read from Vite's import.meta.env
    const providerType = import.meta.env[`${envPrefix}PROVIDER`];
    const model = import.meta.env[`${envPrefix}MODEL`];

    if (!providerType) {
      throw new Error(`Configuration Error: Missing ${envPrefix}PROVIDER in .env`);
    }

    if (!model) {
      throw new Error(`Configuration Error: Missing ${envPrefix}MODEL in .env`);
    }

    switch (providerType.toLowerCase()) {
      case 'ollama': {
        const url = import.meta.env.VITE_PROVIDER_OLLAMA_URL;
        if (!url) {
          throw new Error('Configuration Error: Missing VITE_PROVIDER_OLLAMA_URL in .env');
        }
        return new OllamaProvider(model, url);
      }
      case 'vertex': {
        const projectId = import.meta.env.VITE_PROVIDER_VERTEX_PROJECT_ID;
        const region = import.meta.env.VITE_PROVIDER_VERTEX_REGION;
        const accessToken = import.meta.env.VITE_PROVIDER_VERTEX_ACCESS_TOKEN;

        if (!projectId) throw new Error('Configuration Error: Missing VITE_PROVIDER_VERTEX_PROJECT_ID in .env');
        if (!region) throw new Error('Configuration Error: Missing VITE_PROVIDER_VERTEX_REGION in .env');
        if (!accessToken) throw new Error('Configuration Error: Missing VITE_PROVIDER_VERTEX_ACCESS_TOKEN in .env');

        return new VertexAIProvider(model, projectId, region, accessToken);
      }
      case 'geminiflow': {
        const url = import.meta.env.VITE_PROVIDER_GEMINIFLOW_URL || 'http://127.0.0.1:8000';
        return new GeminiFlowProvider(model, url);
      }
      
      // Future providers can be added here
      // case 'openai': 
      // case 'anthropic':
      
      default:
        throw new Error(`Configuration Error: Unsupported provider type '${providerType}' for agent '${agentName}'`);
    }
  }
}
