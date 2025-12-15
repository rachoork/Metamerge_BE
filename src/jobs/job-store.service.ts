import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export enum JobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface DeepResearchJob {
  jobId: string;
  userId?: string; // For future auth implementation
  status: JobStatus;
  progress: number; // 0-100
  currentIteration?: number; // Current iteration (1-based)
  totalIterations?: number; // Total expected iterations
  query: string;
  options?: {
    depth?: number;
    language?: string;
    modelVersion?: string;
    queryModels?: Array<{ id: string; name: string; provider: string }>;
    judgeModel?: { id: string; name: string; provider: string };
  };
  result: any | null; // Structured result when completed
  error: {
    code: string;
    message: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedRemainingSeconds?: number;
}

@Injectable()
export class JobStoreService {
  private readonly logger = new Logger(JobStoreService.name);
  private readonly jobs: Map<string, DeepResearchJob> = new Map();

  /**
   * Create a new job and store it
   */
  createJob(
    query: string,
    options?: DeepResearchJob['options'],
    userId?: string,
  ): DeepResearchJob {
    const jobId = uuidv4();
    const now = new Date();

    const job: DeepResearchJob = {
      jobId,
      userId,
      status: JobStatus.QUEUED,
      progress: 0,
      query,
      options,
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(jobId, job);
    this.logger.log(`Created job ${jobId} with status: ${job.status}`);

    return job;
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string, userId?: string): DeepResearchJob | null {
    const job = this.jobs.get(jobId);

    if (!job) {
      return null;
    }

    // For future: check if user has access to this job
    if (userId && job.userId && job.userId !== userId) {
      return null;
    }

    return job;
  }

  /**
   * Update job status
   */
  updateJobStatus(
    jobId: string,
    status: JobStatus,
    updates?: Partial<DeepResearchJob>,
  ): boolean {
    const job = this.jobs.get(jobId);

    if (!job) {
      this.logger.warn(`Attempted to update non-existent job: ${jobId}`);
      return false;
    }

    const now = new Date();

    // Update timestamps based on status
    if (status === JobStatus.RUNNING && !job.startedAt) {
      job.startedAt = now;
    }

    if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      job.completedAt = now;
    }

    // Merge updates
    Object.assign(job, {
      ...updates,
      status,
      updatedAt: now,
    });

    this.jobs.set(jobId, job);
    this.logger.log(`Updated job ${jobId} to status: ${status}`);

    return true;
  }

  /**
   * Round progress to nearest multiple of 5
   */
  private roundToMultipleOf5(progress: number): number {
    return Math.round(progress / 5) * 5;
  }

  /**
   * Update job progress
   */
  updateProgress(
    jobId: string,
    progress: number,
    estimatedRemainingSeconds?: number,
    currentIteration?: number,
    totalIterations?: number,
  ): boolean {
    const job = this.jobs.get(jobId);

    if (!job) {
      return false;
    }

    // Round to nearest multiple of 5 and clamp to 0-100
    const roundedProgress = this.roundToMultipleOf5(progress);
    job.progress = Math.max(0, Math.min(100, roundedProgress));
    if (estimatedRemainingSeconds !== undefined) {
      job.estimatedRemainingSeconds = estimatedRemainingSeconds;
    }
    if (currentIteration !== undefined) {
      job.currentIteration = currentIteration;
    }
    if (totalIterations !== undefined) {
      job.totalIterations = totalIterations;
    }
    job.updatedAt = new Date();

    this.jobs.set(jobId, job);
    return true;
  }

  /**
   * Set job result
   */
  setResult(jobId: string, result: any): boolean {
    return this.updateJobStatus(jobId, JobStatus.COMPLETED, {
      result,
      progress: 100,
    });
  }

  /**
   * Set job error
   */
  setError(jobId: string, error: { code: string; message: string }): boolean {
    return this.updateJobStatus(jobId, JobStatus.FAILED, {
      error,
      progress: 0,
    });
  }

  /**
   * Get all queued jobs (for worker)
   */
  getQueuedJobs(): DeepResearchJob[] {
    return Array.from(this.jobs.values()).filter(
      (job) => job.status === JobStatus.QUEUED,
    );
  }

  /**
   * Clean up old completed/failed jobs (optional, for memory management)
   */
  cleanupOldJobs(maxAgeHours: number = 24): number {
    const now = new Date();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) &&
        job.completedAt &&
        now.getTime() - job.completedAt.getTime() > maxAge
      ) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} old jobs`);
    }

    return cleaned;
  }
}

