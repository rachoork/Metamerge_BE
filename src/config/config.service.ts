import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  models: string[];
  judge_model: string;
  per_model_timeout_ms: number;
  judge_timeout_ms: number;
  max_prompt_length: number;
  min_models_for_judge: number;
  max_answer_length_for_judge: number;
  enable_early_judge: boolean;
  enable_debate: boolean;
  max_debate_rounds: number;
  debate_timeout_ms: number;
  judge_feedback_timeout_ms: number;
}

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private config: AppConfig;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const configPath = path.join(process.cwd(), 'config.json');
      const configData = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(configData);

      this.config = {
        models: parsed.models || ['openai/gpt-4o-mini'],
        judge_model: parsed.judge_model || 'openai/gpt-4o',
        per_model_timeout_ms: parsed.per_model_timeout_ms || 20000,
        judge_timeout_ms: parsed.judge_timeout_ms || 25000,
        max_prompt_length: parsed.max_prompt_length || 8000,
        min_models_for_judge: parsed.min_models_for_judge || 2,
        max_answer_length_for_judge: parsed.max_answer_length_for_judge || 5000,
        enable_early_judge: parsed.enable_early_judge !== false,
        enable_debate: parsed.enable_debate !== false,
        max_debate_rounds: parsed.max_debate_rounds || 2,
        debate_timeout_ms: parsed.debate_timeout_ms || 10000,
        judge_feedback_timeout_ms: parsed.judge_feedback_timeout_ms || 8000,
      };
    } catch (error) {
      this.logger.error('Failed to load config.json, using defaults', error);
      this.config = this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): AppConfig {
    return {
      models: ['openai/gpt-4o-mini'],
      judge_model: 'openai/gpt-4o',
      per_model_timeout_ms: 20000,
      judge_timeout_ms: 25000,
      max_prompt_length: 8000,
      min_models_for_judge: 2,
      max_answer_length_for_judge: 5000,
      enable_early_judge: true,
      enable_debate: true,
      max_debate_rounds: 2,
      debate_timeout_ms: 10000,
      judge_feedback_timeout_ms: 8000,
    };
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  get<T extends keyof AppConfig>(key: T): AppConfig[T] {
    return this.config[key];
  }
}

