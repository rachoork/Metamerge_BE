import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface OpenRouterRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://metamerge.app',
        'X-Title': 'MetaMerge',
        'Connection': 'keep-alive',
      },
      timeout: 30000, // 30s default timeout
      httpAgent: new (require('http').Agent)({ keepAlive: true, maxSockets: 50 }),
      httpsAgent: new (require('https').Agent)({ keepAlive: true, maxSockets: 50 }),
    });
  }

  async callModel(
    model: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    timeoutMs: number,
    options?: { temperature?: number; max_tokens?: number },
  ): Promise<{ response: string; latency_ms: number }> {
    const startTime = Date.now();

    try {
      const request: OpenRouterRequest = {
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        ...(options?.max_tokens && { max_tokens: options.max_tokens }),
      };

      const axiosResponse = await this.client.post<OpenRouterResponse>(
        '/chat/completions',
        request,
        {
          timeout: timeoutMs,
        },
      );

      const latency_ms = Date.now() - startTime;

      const content =
        axiosResponse.data.choices[0]?.message?.content || '';
      
      if (!content) {
        throw new Error('Empty response from model');
      }

      return {
        response: content,
        latency_ms,
      };
    } catch (error) {
      const latency_ms = Date.now() - startTime;
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          throw new Error(`Timeout after ${timeoutMs}ms`);
        }
        if (error.response) {
          throw new Error(
            `OpenRouter API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
          );
        }
        throw new Error(`Network error: ${error.message}`);
      }
      throw error;
    }
  }

  async callModelWithRetry(
    model: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    timeoutMs: number,
    maxRetries: number = 1,
    options?: { temperature?: number; max_tokens?: number },
  ): Promise<{ response: string; latency_ms: number }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.callModel(model, messages, timeoutMs, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on timeout or non-transient errors
        if (lastError.message.includes('timeout') || attempt === maxRetries) {
          throw lastError;
        }

        // Wait a bit before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    throw lastError || new Error('Unknown error');
  }

  async generateImage(
    model: string,
    prompt: string,
    timeoutMs: number,
  ): Promise<{ imageUrl: string; latency_ms: number }> {
    const startTime = Date.now();

    try {
      // For image generation models, OpenRouter uses the chat completions endpoint
      // with special handling for image generation models
      // Models like: stability-ai/stable-diffusion-xl, black-forest-labs/flux, etc.
      
      const request = {
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        // Some image models support additional parameters
        // n: 1, // Number of images
        // size: '1024x1024', // Image size (if supported by model)
      };

      const axiosResponse = await this.client.post(
        '/chat/completions',
        request,
        {
          timeout: timeoutMs,
        },
      );

      const latency_ms = Date.now() - startTime;

      // OpenRouter image generation models return images in different formats
      // Check the response structure
      let imageUrl = '';

      const responseData = axiosResponse.data;

      // Try different response formats
      if (responseData.choices && responseData.choices[0]) {
        const content = responseData.choices[0].message?.content;
        
        // Some models return image URLs in the content
        if (typeof content === 'string' && (content.startsWith('http') || content.startsWith('data:'))) {
          imageUrl = content;
        } else if (content && typeof content === 'object') {
          // Some models return structured content
          if (content.url) {
            imageUrl = content.url;
          } else if (content.image) {
            imageUrl = content.image;
          }
        }
      }

      // Check for direct image data in response
      if (!imageUrl) {
        if (responseData.data && responseData.data[0]) {
          const imageData = responseData.data[0];
          if (imageData.url) {
            imageUrl = imageData.url;
          } else if (imageData.b64_json) {
            imageUrl = `data:image/png;base64,${imageData.b64_json}`;
          }
        } else if (responseData.url) {
          imageUrl = responseData.url;
        } else if (responseData.image) {
          imageUrl = responseData.image;
        }
      }

      if (!imageUrl) {
        // Log the response for debugging
        this.logger.warn(`Unexpected image generation response format: ${JSON.stringify(responseData).substring(0, 200)}`);
        throw new Error('No image URL or data returned from model. Check if model supports image generation.');
      }

      return {
        imageUrl,
        latency_ms,
      };
    } catch (error) {
      const latency_ms = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          throw new Error(`Timeout after ${timeoutMs}ms`);
        }
        if (error.response) {
          throw new Error(
            `OpenRouter API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
          );
        }
        throw new Error(`Network error: ${error.message}`);
      }
      throw error;
    }
  }
}

