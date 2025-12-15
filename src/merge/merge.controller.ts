import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { MergeService } from './merge.service';
import { MergeRequestDto } from './dto/merge-request.dto';
import { MergeResponseDto } from './dto/merge-response.dto';
import { ImageGenerationRequestDto } from './dto/image-generation-request.dto';
import { ImageGenerationResponseDto } from './dto/image-generation-response.dto';

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

  @Post('generate-image')
  @HttpCode(HttpStatus.OK)
  async generateImage(
    @Body() body: any, // Use any to bypass validation, then validate manually
  ): Promise<ImageGenerationResponseDto> {
    // Normalize queryModels to imageModels for UI compatibility
    const imageModels = body.imageModels || body.queryModels;
    
    // Manual validation
    if (!imageModels || !Array.isArray(imageModels) || imageModels.length === 0) {
      throw new HttpException(
        'At least one image model must be specified in imageModels or queryModels',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (imageModels.length > 10) {
      throw new HttpException(
        'Maximum 10 models allowed',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.length === 0) {
      throw new HttpException(
        'Prompt is required and must be a non-empty string',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (body.prompt.length > 8000) {
      throw new HttpException(
        'Prompt cannot exceed 8000 characters',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate each model structure
    for (const model of imageModels) {
      if (!model.id || !model.name || !model.provider) {
        throw new HttpException(
          'Each model must have id, name, and provider',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Filter out models that don't support image generation
    // Known image generation models on OpenRouter
    const imageGenerationModelPatterns = [
      'dall-e',
      'stable-diffusion',
      'flux',
      'midjourney',
      'imagen',
      'cogview',
      'kandinsky',
      'playground',
      'leonardo',
      'ideogram',
      'black-forest-labs',
      'stability-ai',
    ];

    const validImageModels = imageModels.filter((model: any) => {
      const modelId = model.id.toLowerCase();
      return imageGenerationModelPatterns.some((pattern) =>
        modelId.includes(pattern),
      );
    });

    if (validImageModels.length === 0) {
      const invalidModelIds = imageModels.map((m: any) => m.id).join(', ');
      
      // Provide actual OpenRouter image generation model IDs
      const suggestedModels = [
        { id: 'openai/dall-e-3', name: 'DALL-E 3', provider: 'OpenAI' },
        { id: 'openai/dall-e-2', name: 'DALL-E 2', provider: 'OpenAI' },
        { id: 'black-forest-labs/flux-1.1-pro', name: 'Flux 1.1 Pro', provider: 'Black Forest Labs' },
        { id: 'black-forest-labs/flux-1.1-schnell', name: 'Flux 1.1 Schnell', provider: 'Black Forest Labs' },
        { id: 'stability-ai/stable-diffusion-xl-base-1.0', name: 'Stable Diffusion XL', provider: 'Stability AI' },
        { id: 'stability-ai/sdxl', name: 'SDXL', provider: 'Stability AI' },
        { id: 'ideogram-ai/ideogram-v2', name: 'Ideogram v2', provider: 'Ideogram' },
        { id: 'playgroundai/playground-v2.5-1024px-aesthetic', name: 'Playground v2.5', provider: 'Playground AI' },
      ];
      
      throw new HttpException(
        {
          message: 'None of the provided models support image generation. Text models (GPT, Claude, Gemini, Mistral) cannot generate images.',
          invalidModels: invalidModelIds,
          suggestion: 'Please use image generation models. Here are some available options:',
          availableImageModels: suggestedModels,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (validImageModels.length < imageModels.length) {
      const filteredOut = imageModels
        .filter((m: any) => !validImageModels.includes(m))
        .map((m: any) => m.id);
      this.logger.warn(
        `Filtered out ${filteredOut.length} non-image-generation models: ${filteredOut.join(', ')}`,
      );
    }

    this.logger.log(
      `Received image generation request - prompt length: ${body.prompt.length}, models: ${validImageModels.length} (${imageModels.length} provided, ${imageModels.length - validImageModels.length} filtered out)`,
    );

    try {
      return await this.mergeService.generateImages(
        body.prompt,
        validImageModels, // Use only valid image generation models
        body.size,
        body.responseFormat,
      );
    } catch (error) {
      // Re-throw HTTP exceptions as-is
      if (error instanceof Error && 'status' in error) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(`Unexpected error in generate-image endpoint: ${error.message}`);
      throw error;
    }
  }

  // Note: Deep research is now handled by async job endpoint at /api/v1/deep-research
  // The old synchronous endpoint has been removed to avoid route conflicts
  // All deep research requests should use the async job endpoint with polling
}

