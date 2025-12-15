export interface ImageResult {
  modelName: string;
  modelId: string;
  provider: string;
  status: 'success' | 'failed';
  latency: number; // in seconds
  imageUrl?: string; // Image URL (for url format)
  imageBase64?: string; // Base64 image (for b64_json format)
  errorMessage?: string; // Only if status === "failed"
}

export interface ImageGenerationResponseDto {
  mergedImageUrl?: string; // Best selected image URL (first successful one)
  mergedImageBase64?: string; // Best selected image base64 (if using b64_json format)
  imageResults: ImageResult[];
  totalLatency: number; // Total time in seconds
  mode: 'image';
}

