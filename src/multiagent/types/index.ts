export interface GenerateRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}
