import { Injectable } from '@nestjs/common';
import { QueryStrategy } from './query-strategy.interface';
import { MergeResponseDto, ModelResult } from '../../merge/dto/merge-response.dto';
import { QueryModelDto, JudgeModelDto } from '../../merge/dto/merge-request.dto';
import { MergeService } from '../../merge/merge.service';

@Injectable()
export class TextQueryStrategy implements QueryStrategy {
  constructor(private readonly mergeService: MergeService) {}

  async execute(
    prompt: string,
    queryModels: QueryModelDto[],
    judgeModel: JudgeModelDto,
    mode?: string,
  ): Promise<MergeResponseDto> {
    const modelIds = queryModels.map((m) => m.id);
    const modelMap = new Map(
      queryModels.map((m) => [m.id, { name: m.name, provider: m.provider }]),
    );

    // Map mode to internal format
    const internalMode =
      mode === 'technical'
        ? 'coding'
        : mode === 'general' || mode === 'creative' || !mode
          ? 'general'
          : 'general';

    const internalResult = await this.mergeService.merge(
      prompt,
      internalMode,
      modelIds,
      judgeModel.id,
      false,
    );

    const modelResults: ModelResult[] = internalResult.model_answers.map(
      (answer) => {
        const modelInfo = modelMap.get(answer.model);
        return {
          modelName: modelInfo?.name || answer.model,
          modelId: answer.model,
          provider: modelInfo?.provider || 'Unknown',
          status: answer.success ? 'success' : 'failed',
          latency: answer.latency_ms / 1000,
          content: answer.answer || '',
          ...(answer.error && { errorMessage: answer.error }),
        };
      },
    );

    return {
      mergedAnswer: internalResult.merged_answer || '',
      modelResults,
      totalLatency: internalResult.meta.total_latency_ms / 1000,
      judgeModelUsed: judgeModel.name,
      mode: 'text',
    };
  }
}

