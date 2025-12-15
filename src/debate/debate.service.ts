import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { ConfigService } from '../config/config.service';

export interface DebateRound {
  round: number;
  judgeFeedback: string;
  answers: Array<{
    model: string;
    answer: string;
    latency_ms: number;
  }>;
}

export interface IterativeDebateResult {
  debateRounds: DebateRound[];
  finalAnswers: Array<{ model: string; answer: string }>;
  totalDebateLatency: number;
}

@Injectable()
export class DebateService {
  private readonly logger = new Logger(DebateService.name);
  private readonly maxDebateRounds: number;
  private readonly debateTimeoutMs: number;
  private readonly judgeModel: string;
  private readonly judgeTimeoutMs: number;

  constructor(
    private readonly openRouterService: OpenRouterService,
    private readonly configService: ConfigService,
  ) {
    // Load config from ConfigService (centralized)
    const config = this.configService.getConfig();
    this.maxDebateRounds = config.max_debate_rounds;
    this.debateTimeoutMs = config.debate_timeout_ms;
    this.judgeModel = config.judge_model;
    this.judgeTimeoutMs = config.judge_feedback_timeout_ms;
  }

  private getJudgeFeedbackPrompt(): string {
    return `You are a debate moderator. After each round, provide brief, actionable feedback (max 100 words) on:
1. What's good in the answers
2. What needs improvement or clarification
3. Key points to address

Be concise and direct.`;
  }

  private async getJudgeFeedback(
    originalPrompt: string,
    currentAnswers: Array<{ model: string; answer: string }>,
    round: number,
  ): Promise<string> {
    const anonymizedAnswers = currentAnswers.map((item, index) => ({
      label: `Expert ${String.fromCharCode(65 + index)}`,
      content: item.answer.substring(0, 500), // Truncate for speed
    }));

    let message = `Round ${round} Answers:\n\n`;
    anonymizedAnswers.forEach((ans) => {
      message += `${ans.label}: ${ans.content}\n\n`;
    });
    message += `Provide brief feedback for the next round.`;

    try {
      const result = await this.openRouterService.callModelWithRetry(
        this.judgeModel,
        [
          { role: 'system', content: this.getJudgeFeedbackPrompt() },
          { role: 'user', content: message },
        ],
        this.judgeTimeoutMs,
        0, // No retries for speed
      );

      return result.response;
    } catch (error) {
      this.logger.warn(`Judge feedback failed: ${error.message}`);
      return 'Continue refining your answers based on other experts\' perspectives.';
    }
  }

  private getDebateSystemPrompt(round: number, judgeFeedback: string): string {
    return `You're in a fast iterative debate. Round ${round}.

Judge Feedback: ${judgeFeedback}

Quickly refine your answer based on:
1. Judge feedback above
2. Other experts' answers below
3. Original question

Be concise. Focus on improvements.`;
  }

  private buildDebateUserMessage(
    originalPrompt: string,
    round: number,
    judgeFeedback: string,
    allAnswers: Array<{ model: string; answer: string }>,
    currentModel: string,
    currentModelAnswer: string,
  ): string {
    let message = `Q: ${originalPrompt}\n\n`;
    message += `Judge Feedback: ${judgeFeedback}\n\n`;
    message += `Other Experts' Answers:\n`;

    allAnswers.forEach((item, index) => {
      if (item.model !== currentModel) {
        const truncated = item.answer.substring(0, 300); // Keep it short
        message += `Expert ${String.fromCharCode(65 + index)}: ${truncated}...\n\n`;
      }
    });

    message += `Your Previous Answer: ${currentModelAnswer.substring(0, 300)}...\n\n`;
    message += `Provide your refined answer (be concise, max 500 words).`;

    return message;
  }

  async conductIterativeDebate(
    originalPrompt: string,
    initialAnswers: Array<{ model: string; answer: string }>,
  ): Promise<IterativeDebateResult> {
    const debateRounds: DebateRound[] = [];
    let currentAnswers = initialAnswers.map((item) => ({ ...item }));
    const totalStartTime = Date.now();

    // Iterative rounds with judge feedback
    for (let round = 1; round <= this.maxDebateRounds; round++) {
      const roundStartTime = Date.now();
      this.logger.log(`Debate Round ${round}/${this.maxDebateRounds}`);

      // Get judge feedback on current answers (fast, parallel with model calls if possible)
      const judgeFeedbackPromise = this.getJudgeFeedback(
        originalPrompt,
        currentAnswers,
        round,
      );

      // Get judge feedback first (needed for next round)
      const judgeFeedback = await judgeFeedbackPromise;

      // All models refine in parallel based on judge feedback
      const refinementPromises = currentAnswers.map(async (item) => {
        const startTime = Date.now();
        try {
          const systemPrompt = this.getDebateSystemPrompt(round, judgeFeedback);
          const userMessage = this.buildDebateUserMessage(
            originalPrompt,
            round,
            judgeFeedback,
            currentAnswers,
            item.model,
            item.answer,
          );

          const result = await this.openRouterService.callModelWithRetry(
            item.model,
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            this.debateTimeoutMs,
            0, // No retries for speed
          );

          return {
            model: item.model,
            answer: result.response,
            latency_ms: Date.now() - startTime,
            success: true,
          };
        } catch (error) {
          this.logger.warn(
            `Model ${item.model} failed in round ${round}, keeping previous answer`,
          );
          // Keep previous answer on failure
          return {
            model: item.model,
            answer: item.answer,
            latency_ms: Date.now() - startTime,
            success: false,
          };
        }
      });

      const refinedAnswers = await Promise.all(refinementPromises);

      // Update current answers
      currentAnswers = refinedAnswers.map((r) => ({
        model: r.model,
        answer: r.answer,
      }));

      // Record round
      debateRounds.push({
        round,
        judgeFeedback,
        answers: refinedAnswers.map((r) => ({
          model: r.model,
          answer: r.answer,
          latency_ms: r.latency_ms,
        })),
      });

      const roundTime = Date.now() - roundStartTime;
      this.logger.log(
        `Round ${round} completed in ${roundTime}ms with ${refinedAnswers.filter((r) => r.success).length}/${refinedAnswers.length} successful`,
      );
    }

    const totalDebateLatency = Date.now() - totalStartTime;

    return {
      debateRounds,
      finalAnswers: currentAnswers,
      totalDebateLatency,
    };
  }
}

