import { Injectable, Logger } from '@nestjs/common';

interface RequestLog {
  request_id: string;
  prompt_hash: string;
  mode: string;
  models: string[];
}

interface ModelResultLog {
  request_id: string;
  model: string;
  latency_ms: number;
  success: boolean;
  error: string | null;
}

interface JudgeResultLog {
  request_id: string;
  judge_model: string | null;
  latency_ms: number;
  success: boolean;
  error: string | null;
}

interface RequestCompleteLog {
  request_id: string;
  total_latency_ms: number;
  success: boolean;
}

@Injectable()
export class LoggerService {
  private readonly logger = new Logger(LoggerService.name);
  private readonly environment: string;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
  }

  logRequest(data: RequestLog): void {
    this.logger.log(
      `[${data.request_id}] Request started - mode: ${data.mode}, models: ${data.models.join(', ')}, prompt_hash: ${data.prompt_hash}`,
    );
  }

  logModelResult(data: ModelResultLog): void {
    const status = data.success ? 'SUCCESS' : 'FAILED';
    this.logger.log(
      `[${data.request_id}] Model ${data.model}: ${status} (${data.latency_ms}ms)${data.error ? ` - ${data.error}` : ''}`,
    );
  }

  logJudgeResult(data: JudgeResultLog): void {
    const status = data.success ? 'SUCCESS' : 'FAILED';
    this.logger.log(
      `[${data.request_id}] Judge ${data.judge_model || 'N/A'}: ${status} (${data.latency_ms}ms)${data.error ? ` - ${data.error}` : ''}`,
    );
  }

  logRequestComplete(data: RequestCompleteLog): void {
    const status = data.success ? 'SUCCESS' : 'FAILED';
    this.logger.log(
      `[${data.request_id}] Request completed: ${status} (total: ${data.total_latency_ms}ms)`,
    );
  }
}

