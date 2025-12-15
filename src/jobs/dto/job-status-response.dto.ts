import { JobStatus } from '../job-store.service';

export interface JobStatusResponseDto {
  jobId: string;
  status: JobStatus;
  progress: number;
  currentIteration?: number; // Current iteration (1-based)
  totalIterations?: number; // Total expected iterations
  result?: any;
  error?: {
    code: string;
    message: string;
  };
  estimatedRemainingSeconds?: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CreateJobResponseDto {
  jobId: string;
  status: 'queued';
}

