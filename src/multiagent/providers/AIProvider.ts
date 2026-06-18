import { GenerateRequest, GenerateResponse } from '../types';

export interface AIProvider {
  readonly name: string;
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}
