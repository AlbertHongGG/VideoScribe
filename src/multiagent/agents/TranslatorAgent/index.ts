import { BaseAgent } from '../BaseAgent';
import { AIProvider } from '../../providers/AIProvider';
import { buildSystemPrompt, buildTranslationPrompt } from './prompts';

export interface SubtitleSegment {
  id: number;
  text: string;
}

export interface TranslationResult {
  id: number;
  translation: string;
}

export class TranslatorAgent extends BaseAgent {
  constructor(provider: AIProvider) {
    super('TranslatorAgent', provider);
  }

  async execute(segments: SubtitleSegment[], targetLanguage: string, previousContext: string = ''): Promise<TranslationResult[]> {
    const systemPrompt = buildSystemPrompt(targetLanguage);
    const prompt = buildTranslationPrompt(segments, previousContext);

    console.log(`[TranslatorAgent] Start translating ${segments.length} segments to ${targetLanguage}...`);

    let retries = 2;
    while (retries >= 0) {
      try {
        console.log(`[TranslatorAgent] Sending chunk... (Attempt ${3 - retries}/3)`);
        const response = await this.provider.generate({
          prompt,
          systemPrompt,
          temperature: 0.2, // Lower temperature for more stable JSON output
          maxTokens: 9192, // Increase max tokens to ensure it doesn't get cut off
        });

        console.log(`[TranslatorAgent] Received response from provider.`);
        let text = response.text.trim();
        // Sometimes LLMs still wrap in markdown despite instructions
        if (text.startsWith('```json')) text = text.replace(/^```json/, '');
        if (text.startsWith('```')) text = text.replace(/^```/, '');
        if (text.endsWith('```')) text = text.replace(/```$/, '');
        text = text.trim();

        // Sometimes Ollama outputs <think>...</think> blocks, we should strip them
        text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        let parsed: TranslationResult[];
        try {
          parsed = JSON.parse(text) as TranslationResult[];
        } catch (parseError) {
          console.error(`[TranslatorAgent] JSON parse error on raw text:\n${text}`);
          throw parseError;
        }

        // Validate
        if (!Array.isArray(parsed)) {
          throw new Error('Output is not an array');
        }

        // Make sure all IDs match
        const inputIds = new Set(segments.map(s => s.id));
        const outputIds = new Set(parsed.map(p => p.id));

        for (const id of inputIds) {
          if (!outputIds.has(id)) {
            throw new Error(`Missing translation for ID ${id}`);
          }
        }

        // Log the execution using the new File Logger
        this.logger.logExecution(
          { prompt, systemPrompt },
          { text: response.text, parsed },
          response.metadata
        );

        return parsed;

      } catch (err: any) {
        this.logger.warn(`Translation parsing failed, retries left: ${retries}. Error:`, err);
        if (retries === 0) throw err;
        retries--;
      }
    }

    throw new Error('Failed to translate segments after retries');
  }
}
