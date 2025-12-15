import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { MergeService } from './merge.service';
import { MergeRequestDto } from './dto/merge-request.dto';
import { MergeResponseDto } from './dto/merge-response.dto';

@Controller('api/v1')
export class MergeController {
  private readonly logger = new Logger(MergeController.name);

  constructor(private readonly mergeService: MergeService) {}

  @Post('query')
  @HttpCode(HttpStatus.OK)
  async query(@Body() mergeRequest: MergeRequestDto): Promise<MergeResponseDto> {
    this.logger.log(
      `Received query request - mode: ${mergeRequest.mode || 'comprehensive'}, prompt length: ${mergeRequest.prompt.length}, models: ${mergeRequest.queryModels.length}, judge: ${mergeRequest.judgeModel.name}`,
    );

    try {
      return await this.mergeService.query(
        mergeRequest.prompt,
        mergeRequest.mode,
        mergeRequest.queryModels,
        mergeRequest.judgeModel,
      );
    } catch (error) {
      // Re-throw HTTP exceptions as-is
      if (error instanceof Error && 'status' in error) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(`Unexpected error in query endpoint: ${error.message}`);
      throw error;
    }
  }
}

