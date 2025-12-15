import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { JudgeService } from '../judge/judge.service';
import { LoggerService } from '../logger/logger.service';
import { DebateService } from '../debate/debate.service';
import {
  MergeResponseDto,
  ModelResult,
  InternalMergeResponseDto,
} from './dto/merge-response.dto';
import { QueryModelDto, JudgeModelDto } from './dto/merge-request.dto';
import { ImageGenerationService } from '../image-generation/image-generation.service';
import { DeepResearchService } from '../research/deep-research.service';
import { ConfigService } from '../config/config.service';
import { ImageGenerationRequestDto } from './dto/image-generation-request.dto';
import { ImageGenerationResponseDto, ImageResult } from './dto/image-generation-response.dto';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

interface ModelCallResult {
  model: string;
  answer: string | null;
  latency_ms: number;
  success: boolean;
  error: string | null;
}

@Injectable()
export class MergeService {
  private readonly logger = new Logger(MergeService.name);
  private readonly models: string[];
  private readonly perModelTimeoutMs: number;
  private readonly maxPromptLength: number;
  private readonly judgeModel: string;
  private readonly minModelsForJudge: number;
  private readonly enableEarlyJudge: boolean;
  private readonly enableDebate: boolean;

  constructor(
    private readonly openRouterService: OpenRouterService,
    private readonly judgeService: JudgeService,
    private readonly loggerService: LoggerService,
    private readonly debateService: DebateService,
    private readonly imageGenerationService: ImageGenerationService,
    private readonly deepResearchService: DeepResearchService,
    private readonly configService: ConfigService,
  ) {
    // Load config from ConfigService (backward compatible)
    const config = this.configService.getConfig();
    this.models = config.models;
    this.perModelTimeoutMs = config.per_model_timeout_ms;
    this.maxPromptLength = config.max_prompt_length;
    this.judgeModel = config.judge_model;
    this.minModelsForJudge = config.min_models_for_judge;
    this.enableEarlyJudge = config.enable_early_judge;
    this.enableDebate = config.enable_debate;
  }

  private getModelSystemPrompt(mode?: string): string {
    const basePrompt =
      'You are one of several models in a council answering the same question. Answer clearly and directly.';

    if (mode === 'coding') {
      return `${basePrompt} Provide code examples and explanations when relevant.`;
    } else if (mode === 'system-design') {
      return `${basePrompt} Focus on architecture, scalability, and trade-offs.`;
    }

    return basePrompt;
  }

  private async callSingleModel(
    model: string,
    prompt: string,
    mode?: string,
  ): Promise<ModelCallResult> {
    const startTime = Date.now();
    const systemPrompt = this.getModelSystemPrompt(mode);

    try {
      const result = await this.openRouterService.callModelWithRetry(
        model,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        this.perModelTimeoutMs,
        1, // One retry for transient errors
      );

      return {
        model,
        answer: result.response,
        latency_ms: result.latency_ms,
        success: true,
        error: null,
      };
    } catch (error) {
      const latency_ms = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        model,
        answer: null,
        latency_ms,
        success: false,
        error: errorMessage,
      };
    }
  }

  async merge(
    prompt: string,
    mode?: string,
    customModels?: string[],
    customJudgeModel?: string,
    useFewerModels?: boolean,
  ): Promise<InternalMergeResponseDto> {
    const requestId = uuidv4();
    const overallStartTime = Date.now();
    const promptHash = crypto
      .createHash('sha256')
      .update(prompt)
      .digest('hex')
      .substring(0, 16);

    // Use only models provided from UI - no defaults
    let modelsToUse: string[] = [];
    if (customModels && customModels.length > 0) {
      modelsToUse = customModels;
      this.logger.log(`[${requestId}] Using models from UI: ${modelsToUse.join(', ')}`);
    } else {
      // If no models provided, throw error (UI must provide models)
      throw new HttpException(
        'No models provided. Please specify models in the request.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (modelsToUse.length === 0) {
      throw new HttpException(
        'At least one model must be provided',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Determine judge model: custom from UI or default from config
    const judgeModelToUse = customJudgeModel || this.judgeModel;
    if (customJudgeModel) {
      this.logger.log(`[${requestId}] Using custom judge model from UI: ${judgeModelToUse}`);
    }

    // Log request start
    this.loggerService.logRequest({
      request_id: requestId,
      prompt_hash: promptHash,
      mode: mode || 'general',
      models: modelsToUse,
    });

    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      throw new HttpException(
        'Prompt is required and cannot be empty',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (prompt.length > this.maxPromptLength) {
      throw new HttpException(
        `Prompt cannot exceed ${this.maxPromptLength} characters`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Call all models in parallel
    this.logger.log(`[${requestId}] Starting parallel model calls for ${modelsToUse.length} models...`);
    const modelCallPromises = modelsToUse.map((model) =>
      this.callSingleModel(model, prompt, mode),
    );

    // OPTIMIZATION: Start judge as soon as we have enough successful responses
    let judgePromise: Promise<string> | null = null;
    let judgeStartTime: number | null = null;
    const successfulResults: ModelCallResult[] = [];
    const modelResults: ModelCallResult[] = [];
    let judgeStarted = false;

    // Helper to start judge when we have enough results
    const maybeStartJudge = () => {
      if (
        !judgeStarted &&
        successfulResults.length >= this.minModelsForJudge &&
        this.enableEarlyJudge
      ) {
        judgeStarted = true;
        judgeStartTime = Date.now();
        this.logger.log(
          `[${requestId}] Starting early judge with ${successfulResults.length} successful models...`,
        );
        judgePromise = this.judgeService.judgeAndMerge(
          prompt,
          successfulResults.map((r) => ({
            model: r.model,
            answer: r.answer!,
          })),
          undefined,
          judgeModelToUse,
        );
      }
    };

    // Process results as they come in (early judge optimization)
    if (this.enableEarlyJudge) {
      // Wrap each promise to track completion
      const wrappedPromises = modelCallPromises.map(async (promise, index) => {
        try {
          const result = await promise;
          modelResults.push(result);

          // Log immediately
          this.loggerService.logModelResult({
            request_id: requestId,
            model: result.model,
            latency_ms: result.latency_ms,
            success: result.success,
            error: result.error,
          });

          // If successful, add to successful results and maybe start judge
          if (result.success) {
            successfulResults.push(result);
            maybeStartJudge();
          }

          return result;
        } catch (error) {
          const errorResult: ModelCallResult = {
            model: modelsToUse[index], // Use user-selected models, not default models
            answer: null,
            latency_ms: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          modelResults.push(errorResult);

          this.loggerService.logModelResult({
            request_id: requestId,
            model: errorResult.model,
            latency_ms: errorResult.latency_ms,
            success: false,
            error: errorResult.error,
          });

          return errorResult;
        }
      });

      // Wait for all to complete
      await Promise.all(wrappedPromises);

      // If judge wasn't started early, start it now with all successful results
      if (!judgeStarted) {
        if (successfulResults.length === 0) {
          this.logger.error(`[${requestId}] All model calls failed`);
          const totalLatency = Date.now() - overallStartTime;

          this.loggerService.logJudgeResult({
            request_id: requestId,
            judge_model: null,
            latency_ms: 0,
            success: false,
            error: 'All models failed',
          });

          this.loggerService.logRequestComplete({
            request_id: requestId,
            total_latency_ms: totalLatency,
            success: false,
          });

          throw new HttpException(
            {
              merged_answer: null,
              model_answers: modelResults,
              meta: {
                total_latency_ms: totalLatency,
                timestamp: new Date().toISOString(),
                request_id: requestId,
              },
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        judgeStartTime = Date.now();
        this.logger.log(`[${requestId}] Calling judge model: ${judgeModelToUse}...`);
        judgePromise = this.judgeService.judgeAndMerge(
          prompt,
          successfulResults.map((r) => ({
            model: r.model,
            answer: r.answer!,
          })),
          undefined,
          judgeModelToUse,
        );
      }
    } else {
      // Original behavior: wait for all models
      const allResults = await Promise.all(modelCallPromises);
      modelResults.push(...allResults);

      // Log model results
      modelResults.forEach((result) => {
        this.loggerService.logModelResult({
          request_id: requestId,
          model: result.model,
          latency_ms: result.latency_ms,
          success: result.success,
          error: result.error,
        });
      });

      // Check if at least one model succeeded
      const filteredSuccessful = modelResults.filter((r) => r.success);
      successfulResults.push(...filteredSuccessful);

      if (successfulResults.length === 0) {
        this.logger.error(`[${requestId}] All model calls failed`);
        const totalLatency = Date.now() - overallStartTime;

        this.loggerService.logJudgeResult({
          request_id: requestId,
          judge_model: null,
          latency_ms: 0,
          success: false,
          error: 'All models failed',
        });

        this.loggerService.logRequestComplete({
          request_id: requestId,
          total_latency_ms: totalLatency,
          success: false,
        });

        throw new HttpException(
          {
            merged_answer: null,
            model_answers: modelResults,
            meta: {
              total_latency_ms: totalLatency,
              timestamp: new Date().toISOString(),
              request_id: requestId,
            },
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      judgeStartTime = Date.now();
      this.logger.log(`[${requestId}] Calling judge model (${judgeModelToUse})...`);
      judgePromise = this.judgeService.judgeAndMerge(
        prompt,
        successfulResults.map((r) => ({
          model: r.model,
          answer: r.answer!,
        })),
        undefined,
        judgeModelToUse,
      );
    }

    // OPTIMIZATION: Conduct iterative debate if enabled
    let debateRounds: Array<{ round: number; judgeFeedback: string; answers: Array<{ model: string; answer: string }> }> | undefined;
    let finalAnswersForJudge = successfulResults.map((r) => ({
      model: r.model,
      answer: r.answer!,
    }));

    if (this.enableDebate && successfulResults.length >= 2) {
      try {
        this.logger.log(`[${requestId}] Starting iterative debate...`);
        const debateResult = await this.debateService.conductIterativeDebate(
          prompt,
          finalAnswersForJudge,
        );

        debateRounds = debateResult.debateRounds;
        finalAnswersForJudge = debateResult.finalAnswers;

        this.logger.log(
          `[${requestId}] Debate completed in ${debateResult.totalDebateLatency}ms with ${debateRounds.length} rounds`,
        );
      } catch (error) {
        this.logger.warn(
          `[${requestId}] Debate failed: ${error.message}. Continuing with initial answers.`,
        );
        // Continue with initial answers if debate fails
      }
    }

    // Wait for judge to complete (or start if not started early)
    let mergedAnswer: string | null = null;
    let judgeLatency = 0;

    // If judge wasn't started early, start it now with final answers
    if (!judgePromise) {
      judgeStartTime = Date.now();
      this.logger.log(`[${requestId}] Calling judge model with final answers...`);
      judgePromise = this.judgeService.judgeAndMerge(
        prompt,
        finalAnswersForJudge,
        debateRounds,
      );
    } else if (debateRounds && debateRounds.length > 0) {
      // Judge was started early, but we need to update it with final debate answers
      judgeStartTime = Date.now();
      this.logger.log(`[${requestId}] Calling judge with debated answers...`);
      judgePromise = this.judgeService.judgeAndMerge(
        prompt,
        finalAnswersForJudge,
        debateRounds,
      );
    }

    try {
      mergedAnswer = await judgePromise!;
      judgeLatency = Date.now() - (judgeStartTime || Date.now());

      this.loggerService.logJudgeResult({
        request_id: requestId,
        judge_model: judgeModelToUse,
        latency_ms: judgeLatency,
        success: true,
        error: null,
      });
    } catch (error) {
      judgeLatency = Date.now() - (judgeStartTime || Date.now());
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn(
        `[${requestId}] Judge model failed: ${errorMessage}. Using fallback.`,
      );

      this.loggerService.logJudgeResult({
        request_id: requestId,
        judge_model: judgeModelToUse,
        latency_ms: judgeLatency,
        success: false,
        error: errorMessage,
      });

      // Fallback: use best answer from final debate or first successful
      mergedAnswer = finalAnswersForJudge[0]?.answer || successfulResults[0]?.answer || null;
    }

    const totalLatency = Date.now() - overallStartTime;

    this.loggerService.logRequestComplete({
      request_id: requestId,
      total_latency_ms: totalLatency,
      success: true,
    });

    return {
      merged_answer: mergedAnswer,
      model_answers: modelResults,
      meta: {
        total_latency_ms: totalLatency,
        timestamp: new Date().toISOString(),
        request_id: requestId,
      },
    };
  }

  async query(
    prompt: string,
    mode: 'comprehensive' | 'concise' | 'technical' | 'creative' | 'general' | 'query' | 'image-generation' | 'deep-research' | undefined,
    queryModels: QueryModelDto[],
    judgeModel: JudgeModelDto,
  ): Promise<MergeResponseDto> {
    const requestId = uuidv4();
    const overallStartTime = Date.now();

    // Normalize "query" mode to "general"
    if (mode === 'query') {
      mode = 'general';
    }

    // Handle deep research mode
    if (mode === 'deep-research') {
      this.logger.log(`[${requestId}] Processing deep research request`);
      
      const researchResult = await this.deepResearchService.performDeepResearch(
        prompt,
        queryModels,
        judgeModel,
      );

      // Transform to response format
      const modelResults: ModelResult[] = researchResult.modelAnswers.map(
        (answer) => {
          const modelInfo = queryModels.find((m) => m.id === answer.model);
          return {
            modelName: modelInfo?.name || answer.model,
            modelId: answer.model,
            provider: modelInfo?.provider || 'Unknown',
            status: answer.answer ? 'success' : 'failed',
            latency: 0, // Will be calculated in research service
            content: answer.answer,
          };
        },
      );

      const totalLatency = Date.now() - overallStartTime;

      return {
        mergedAnswer: researchResult.finalAnswer,
        modelResults,
        totalLatency: totalLatency / 1000,
        judgeModelUsed: judgeModel.name,
        mode: 'deep-research',
        citations: researchResult.citations,
        researchSources: researchResult.researchContext.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
        })),
      };
    }

    // Handle image generation mode - reuse the dedicated method
    if (mode === 'image-generation') {
      this.logger.log(`[${requestId}] Processing image generation request via query endpoint`);
      
      const imageResponse = await this.generateImages(
        prompt,
        queryModels,
        undefined, // size - use default
        'url', // responseFormat - default to URL
      );

      // Transform ImageGenerationResponseDto to MergeResponseDto format
      const modelResults: ModelResult[] = imageResponse.imageResults.map((result) => ({
        modelName: result.modelName,
        modelId: result.modelId,
        provider: result.provider,
        status: result.status,
        latency: result.latency,
        imageUrl: result.imageUrl,
        ...(result.errorMessage && { errorMessage: result.errorMessage }),
      }));

      return {
        mergedImageUrl: imageResponse.mergedImageUrl,
        modelResults,
        totalLatency: imageResponse.totalLatency,
        mode: 'image',
      };
    }

    // Handle text generation mode (existing logic)
    // Extract model IDs and create mapping for response
    // UI sends the models to use - we only use those, no defaults
    const modelIds = queryModels.map((m) => m.id);
    const modelMap = new Map(
      queryModels.map((m) => [m.id, { name: m.name, provider: m.provider }]),
    );

    if (modelIds.length === 0) {
      throw new HttpException(
        'At least one query model must be provided',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Map mode to internal mode format
    const internalMode =
      mode === 'technical'
        ? 'coding'
        : mode === 'general' || mode === 'creative' || !mode
          ? 'general'
          : 'general';

    // Call internal merge method with UI-provided models only
    const internalResult = await this.merge(
      prompt,
      internalMode,
      modelIds, // Use only UI-provided models
      judgeModel.id,
      false,
    );

    // Transform response to new API format
    const modelResults: ModelResult[] = internalResult.model_answers.map(
      (answer) => {
        const modelInfo = modelMap.get(answer.model);
        return {
          modelName: modelInfo?.name || answer.model,
          modelId: answer.model,
          provider: modelInfo?.provider || 'Unknown',
          status: answer.success ? 'success' : 'failed',
          latency: answer.latency_ms / 1000, // Convert ms to seconds
          content: answer.answer || '',
          ...(answer.error && { errorMessage: answer.error }),
        };
      },
    );

    // Get judge model name
    const judgeModelName = judgeModel.name;

    return {
      mergedAnswer: internalResult.merged_answer || '',
      modelResults,
      totalLatency: internalResult.meta.total_latency_ms / 1000, // Convert ms to seconds
      judgeModelUsed: judgeModelName,
      mode: 'text',
    };
  }

  async generateImages(
    prompt: string,
    imageModels: Array<{ id: string; name: string; provider: string }>,
    size?: string,
    responseFormat?: 'url' | 'b64_json',
  ): Promise<ImageGenerationResponseDto> {
    const requestId = uuidv4();
    const overallStartTime = Date.now();

    this.logger.log(`[${requestId}] Processing image generation request - models: ${imageModels.length}`);

    // Validate image models
    if (!imageModels || imageModels.length === 0) {
      throw new HttpException(
        'At least one image model must be specified',
        HttpStatus.BAD_REQUEST,
      );
    }

    const modelIds = imageModels.map((m) => m.id);
    const modelMap = new Map(
      imageModels.map((m) => [m.id, { name: m.name, provider: m.provider }]),
    );

    // Generate images from all models in parallel
    const imageResults = await this.imageGenerationService.generateImagesFromMultipleModels(
      prompt,
      modelIds,
      this.perModelTimeoutMs,
    );

    // Transform to response format
    const imageResultsFormatted: ImageResult[] = imageResults.map((result) => {
      const modelInfo = modelMap.get(result.model);
      const baseResult: ImageResult = {
        modelName: modelInfo?.name || result.model,
        modelId: result.model,
        provider: modelInfo?.provider || 'Unknown',
        status: result.success ? 'success' : 'failed',
        latency: result.latency_ms / 1000,
        ...(result.error && { errorMessage: result.error }),
      };

      // Add image URL or base64 based on result
      if (result.success && result.imageUrl) {
        if (responseFormat === 'b64_json' && result.imageUrl.startsWith('data:')) {
          baseResult.imageBase64 = result.imageUrl;
        } else {
          baseResult.imageUrl = result.imageUrl;
        }
      }

      return baseResult;
    });

    // Select best image (first successful one)
    const successfulImages = imageResults.filter((r) => r.success);
    const mergedImageUrl = successfulImages.length > 0
      ? successfulImages[0].imageUrl
      : undefined;
    const mergedImageBase64 = responseFormat === 'b64_json' && mergedImageUrl?.startsWith('data:')
      ? mergedImageUrl
      : undefined;

    const totalLatency = Date.now() - overallStartTime;

    return {
      mergedImageUrl: mergedImageUrl && !mergedImageBase64 ? mergedImageUrl : undefined,
      mergedImageBase64,
      imageResults: imageResultsFormatted,
      totalLatency: totalLatency / 1000,
      mode: 'image',
    };
  }
}

