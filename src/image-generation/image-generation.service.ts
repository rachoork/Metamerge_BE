import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../openrouter/openrouter.service';

export interface ImageGenerationResult {
  imageUrl: string;
  model: string;
  latency_ms: number;
  success: boolean;
  error: string | null;
}

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);

  constructor(private readonly openRouterService: OpenRouterService) {}

  async generateImage(
    prompt: string,
    model: string,
    timeoutMs: number = 30000,
  ): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    try {
      // For image generation, we use the model's image generation endpoint
      // OpenRouter supports image generation models like:
      // - stability-ai/stable-diffusion-xl-base-1.0
      // - black-forest-labs/flux-1.1-pro
      // - openai/dall-e-3
      // etc.

      const result = await this.openRouterService.generateImage(
        model,
        prompt,
        timeoutMs,
      );

      return {
        imageUrl: result.imageUrl,
        model,
        latency_ms: Date.now() - startTime,
        success: true,
        error: null,
      };
    } catch (error) {
      const latency_ms = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Image generation failed for ${model}: ${errorMessage}`);

      return {
        imageUrl: '',
        model,
        latency_ms,
        success: false,
        error: errorMessage,
      };
    }
  }

  async generateImagesFromMultipleModels(
    prompt: string,
    models: string[],
    timeoutMs: number = 30000,
  ): Promise<ImageGenerationResult[]> {
    // Generate images in parallel from multiple models
    const promises = models.map((model) =>
      this.generateImage(prompt, model, timeoutMs),
    );

    return Promise.all(promises);
  }
}

