import { AIProvider } from '../providers/AIProvider';
import { AgentLogger } from '../logger/AgentLogger';

export interface Agent {
  readonly name: string;
  execute(...args: any[]): Promise<any>;
}

export abstract class BaseAgent implements Agent {
  public readonly name: string;
  protected provider: AIProvider;
  protected logger: AgentLogger;

  constructor(name: string, provider: AIProvider) {
    this.name = name;
    this.provider = provider;
    this.logger = new AgentLogger(name);
  }

  /**
   * The main method to be implemented by concrete agents.
   */
  abstract execute(...args: any[]): Promise<any>;
}
