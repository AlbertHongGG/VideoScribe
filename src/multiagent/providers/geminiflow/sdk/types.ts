export interface GeminiFlowChatPayload {
  prompt: string;
  model: string;
  language: string;
  save_images: boolean;
  system_prompt?: string;
  images?: string[];
  session_id?: string;
}

export interface GeminiFlowChatResponse {
  text: string;
  images?: string[];
}

export interface GeminiFlowStreamData {
  chunk?: string;
  path?: string;
  url?: string;
}
