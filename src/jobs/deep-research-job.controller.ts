import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { JobStoreService, JobStatus } from './job-store.service';
import { DeepResearchWorkerService } from './deep-research-worker.service';
import { CreateDeepResearchJobDto } from './dto/create-deep-research-job.dto';
import { CreateJobResponseDto, JobStatusResponseDto } from './dto/job-status-response.dto';

@Controller('api/v1/deep-research')
export class DeepResearchJobController {
  private readonly logger = new Logger(DeepResearchJobController.name);

  constructor(
    private readonly jobStore: JobStoreService,
    private readonly worker: DeepResearchWorkerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async createJob(
    @Body() body: any, // Accept both formats for UI compatibility
  ): Promise<CreateJobResponseDto> {
    // Support both formats:
    // 1. New async format: { query, options }
    // 2. UI format: { prompt, queryModels, judgeModel }
    const query = body.query || body.prompt;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new HttpException(
        'Query/prompt is required and cannot be empty',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Normalize options from UI format
    const options = body.options || {
      queryModels: body.queryModels,
      judgeModel: body.judgeModel,
      depth: body.depth,
      language: body.language,
    };

    this.logger.log(
      `Creating deep research job for query: ${query.substring(0, 50)}...`,
    );

    // Create job
    const job = this.jobStore.createJob(
      query,
      options,
      undefined, // userId - will be extracted from auth context in future
    );

    // Trigger worker to process (it will pick up queued jobs automatically)
    // For immediate processing, we can trigger it here
    setImmediate(() => {
      this.worker.processJob(job.jobId).catch((error) => {
        this.logger.error(`Failed to process job ${job.jobId}: ${error.message}`);
      });
    });

    return {
      jobId: job.jobId,
      status: 'queued',
    };
  }

  @Get(':jobId')
  @HttpCode(HttpStatus.OK)
  async getJobStatus(@Param('jobId') jobId: string): Promise<JobStatusResponseDto> {
    // TODO: Extract userId from auth context
    const userId = undefined;

    const job = this.jobStore.getJob(jobId, userId);

    if (!job) {
      throw new HttpException(
        {
          message: 'Job not found',
          jobId,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Format response based on status
    const response: JobStatusResponseDto = {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };

    // Add iteration tracking
    if (job.currentIteration !== undefined) {
      response.currentIteration = job.currentIteration;
    }
    if (job.totalIterations !== undefined) {
      response.totalIterations = job.totalIterations;
    }

    if (job.startedAt) {
      response.startedAt = job.startedAt.toISOString();
    }

    if (job.completedAt) {
      response.completedAt = job.completedAt.toISOString();
    }

    if (job.status === JobStatus.COMPLETED && job.result) {
      response.result = job.result;
    }

    if (job.status === JobStatus.FAILED && job.error) {
      response.error = job.error;
    }

    if (job.status === JobStatus.RUNNING && job.estimatedRemainingSeconds !== undefined) {
      response.estimatedRemainingSeconds = job.estimatedRemainingSeconds;
    }

    return response;
  }
}

