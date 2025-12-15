import { MergeResponseDto } from '../../merge/dto/merge-response.dto';
import { QueryModelDto, JudgeModelDto } from '../../merge/dto/merge-request.dto';

export interface QueryStrategy {
  execute(
    prompt: string,
    queryModels: QueryModelDto[],
    judgeModel: JudgeModelDto,
  ): Promise<MergeResponseDto>;
}

