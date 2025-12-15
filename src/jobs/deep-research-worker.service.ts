import { Injectable, Logger } from '@nestjs/common';
import { JobStoreService, JobStatus } from './job-store.service';
import { DeepResearchService } from '../research/deep-research.service';

@Injectable()
export class DeepResearchWorkerService {
  private readonly logger = new Logger(DeepResearchWorkerService.name);
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly jobStore: JobStoreService,
    private readonly deepResearchService: DeepResearchService,
  ) {
    // Start processing jobs on initialization
    this.startProcessing();
  }

  /**
   * Start the worker to process queued jobs
   */
  startProcessing() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.logger.log('Deep research worker started');

    // Process jobs every 2 seconds
    this.processingInterval = setInterval(() => {
      this.processNextJob();
    }, 2000);
  }

  /**
   * Stop the worker
   */
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
    this.logger.log('Deep research worker stopped');
  }

  /**
   * Process the next queued job
   */
  private async processNextJob() {
    const queuedJobs = this.jobStore.getQueuedJobs();

    if (queuedJobs.length === 0) {
      return;
    }

    // Process the first queued job
    const job = queuedJobs[0];
    await this.processJob(job.jobId);
  }

  /**
   * Process a single job
   */
  async processJob(jobId: string) {
    const job = this.jobStore.getJob(jobId);

    if (!job || job.status !== JobStatus.QUEUED) {
      return;
    }

    // Update status to running
    this.jobStore.updateJobStatus(jobId, JobStatus.RUNNING);
    this.jobStore.updateProgress(jobId, 0);

    this.logger.log(`Processing job ${jobId}: ${job.query.substring(0, 50)}...`);

    try {
      // Extract models from options or use defaults
      const queryModels =
        job.options?.queryModels || [
          { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
        ];

      const judgeModel =
        job.options?.judgeModel || {
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          provider: 'OpenAI',
        };

      // Define total iterations for deep research
      // Iteration 1: Web research
      // Iteration 2: Initial model answers
      // Iteration 3: Debate round 1
      // Iteration 4: Debate round 2 (if enabled)
      // Iteration 5: Judge synthesis
      const totalIterations = 5; // Research + Models + 2 Debate rounds + Judge
      this.jobStore.updateProgress(jobId, 0, undefined, 0, totalIterations);
      this.logger.log(`[${jobId}] Starting research phase...`);

      // Perform deep research with progress callbacks (pass jobId for logging)
      const result = await this.performDeepResearchWithProgress(
        job.query,
        queryModels,
        judgeModel,
        jobId, // Pass jobId for correlation in logs
        (progress, estimatedSeconds, currentIteration) => {
          this.jobStore.updateProgress(
            jobId,
            progress,
            estimatedSeconds,
            currentIteration,
            totalIterations,
          );
        },
      );

      // Store result and mark as completed with metadata
      const researchSources = result.researchContext.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
      }));

      // Determine if external sources were used
      const usedExternalSources = result.researchContext.results.length > 0;
      const hasCitations = result.citations.length > 0;
      
      // Determine fallback reason if applicable
      let fallbackReason: string | null = null;
      if (!usedExternalSources) {
        fallbackReason = 'NO_EXTERNAL_SOURCES';
      } else if (!hasCitations) {
        fallbackReason = 'NO_CITATIONS_EXTRACTED';
      }

      this.logger.log(`[${jobId}] Storing result: ${researchSources.length} sources, ${result.citations.length} citations, usedExternalSources: ${usedExternalSources}`);

      this.jobStore.setResult(jobId, {
        summary: result.finalAnswer,
        sections: this.formatResultSections(result),
        citations: result.citations,
        researchSources: researchSources,
        debateRounds: result.debateRounds,
        modelAnswers: result.modelAnswers,
        metadata: {
          usedExternalSources: usedExternalSources,
          researchSourcesCount: researchSources.length,
          citationsCount: result.citations.length,
          fallbackReason: fallbackReason,
          toolErrors: [], // Can be populated if we track tool errors
        },
      });

      this.logger.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = this.getErrorCode(error);

      this.jobStore.setError(jobId, {
        code: errorCode,
        message: errorMessage,
      });

      this.logger.error(`Job ${jobId} failed: ${errorMessage}`);
    }
  }

  /**
   * Perform deep research with progress updates
   */
  private async performDeepResearchWithProgress(
    query: string,
    queryModels: Array<{ id: string; name: string; provider: string }>,
    judgeModel: { id: string; name: string; provider: string },
    jobId: string,
    onProgress: (
      progress: number,
      estimatedSeconds?: number,
      currentIteration?: number,
    ) => void,
  ) {
    try {
      const totalIterations = 5;
      // Progress milestones in multiples of 5: 10%, 30%, 50%, 70%, 100%
      const progressMilestones = [10, 30, 50, 70, 100];

      // Iteration 1: Web research (10% progress)
      onProgress(progressMilestones[0], 300, 1);
      this.logger.log(`[${jobId}] [Iteration 1/5] Starting web research...`);

      // We need to integrate progress callbacks into the deep research service
      // For now, we'll simulate progress updates based on estimated timing
      // TODO: Integrate actual progress callbacks into DeepResearchService

      // Start the research process
      const researchPromise = this.deepResearchService.performDeepResearch(
        query,
        queryModels,
        judgeModel,
        jobId, // Pass jobId for logging
      );

      // Simulate progress updates during research
      // Iteration 2: Initial model answers (30% progress)
      setTimeout(() => {
        onProgress(progressMilestones[1], 240, 2);
        this.logger.log(`[${jobId}] [Iteration 2/5] Getting initial model answers...`);
      }, 2000);

      // Iteration 3: Debate round 1 (50% progress)
      setTimeout(() => {
        onProgress(progressMilestones[2], 180, 3);
        this.logger.log(`[${jobId}] [Iteration 3/5] Conducting debate round 1...`);
      }, 4000);

      // Iteration 4: Debate round 2 (70% progress)
      setTimeout(() => {
        onProgress(progressMilestones[3], 120, 4);
        this.logger.log(`[${jobId}] [Iteration 4/5] Conducting debate round 2...`);
      }, 6000);

      // Wait for research to complete
      const researchResult = await researchPromise;

      // Iteration 5: Judge synthesis (100% progress)
      onProgress(progressMilestones[4], 0, totalIterations);
      this.logger.log(`[${jobId}] [Iteration 5/5] Judge synthesis complete...`);

      return researchResult;
    } catch (error) {
      this.logger.error(`[${jobId}] Deep research failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Format result into sections
   */
  private formatResultSections(result: any): any[] {
    const sections: any[] = [
      {
        title: 'Research Summary',
        content: result.finalAnswer,
        type: 'summary',
      },
    ];

    // Add citations section if citations exist
    if (result.citations && result.citations.length > 0) {
      sections.push({
        title: 'Citations',
        content: result.citations,
        type: 'citations',
      });
    }

    // Add research sources section if sources exist
    if (result.researchContext?.results && result.researchContext.results.length > 0) {
      sections.push({
        title: 'Research Sources',
        content: result.researchContext.results.map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
        })),
        type: 'sources',
      });
    }

    return sections;
  }

  /**
   * Get error code from error
   */
  private getErrorCode(error: any): string {
    if (error?.message?.includes('timeout')) {
      return 'RESEARCH_TIMEOUT';
    }
    if (error?.message?.includes('rate limit')) {
      return 'RATE_LIMIT_EXCEEDED';
    }
    if (error?.message?.includes('invalid')) {
      return 'INVALID_INPUT';
    }
    return 'RESEARCH_FAILED';
  }
}

