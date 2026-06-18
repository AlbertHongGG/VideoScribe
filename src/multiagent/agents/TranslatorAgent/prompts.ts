import { SubtitleSegment } from './index';

export function buildSystemPrompt(targetLanguage: string): string {
  return `You are a professional audiovisual subtitle translator and localization expert.
Your task is to translate the provided subtitle segments into ${targetLanguage}.

Rules:
1. Do not just translate literally. Adjust the tone, vocabulary, and phrasing to be perfectly natural and colloquial for native speakers of ${targetLanguage}.
2. Use the provided [Previous Context] to understand the flow of the conversation, but DO NOT translate the [Previous Context].
3. You MUST output ONLY a valid JSON array of objects. Each object must have "id" (number) and "translation" (string).
4. Do not wrap the JSON in markdown code blocks (\`\`\`json). Just output the raw JSON array.
5. Make sure every single segment ID from the input is present in the output.`;
}

export function buildTranslationPrompt(segments: SubtitleSegment[], previousContext: string = ''): string {
  return `${previousContext ? `[Previous Context]\n${previousContext}\n\n` : ''}[Segments to Translate]
${JSON.stringify(segments, null, 2)}`;
}
