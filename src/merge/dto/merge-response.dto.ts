// New API v1 response format
export interface ModelResult {
  modelName: string;
  modelId: string;
  provider: string;
  status: 'success' | 'failed';
  latency: number; // in seconds
  content?: string; // Markdown response (for text mode)
  imageUrl?: string; // Image URL (for image-generation mode)
  errorMessage?: string; // Only if status === "failed"
}

export interface MergeResponseDto {
  mergedAnswer?: string; // Markdown-formatted synthesized answer (for text mode)
  mergedImageUrl?: string; // Best selected image URL (for image-generation mode)
  modelResults: ModelResult[];
  totalLatency: number; // Total time in seconds
  judgeModelUsed?: string; // Name of judge model used (for text mode)
  mode: 'text' | 'image' | 'deep-research'; // Response type
  citations?: string[]; // Research citations (for deep-research mode)
  researchSources?: Array<{ title: string; url: string; snippet: string }>; // Research sources
}

// Internal format (for backward compatibility)
export interface ModelAnswer {
  model: string;
  answer: string | null;
  latency_ms: number;
  success: boolean;
  error: string | null;
}

export interface MergeResponseMeta {
  total_latency_ms: number;
  timestamp: string;
  request_id: string;
}

export interface InternalMergeResponseDto {
  merged_answer: string | null;
  model_answers: ModelAnswer[];
  meta: MergeResponseMeta;
}

