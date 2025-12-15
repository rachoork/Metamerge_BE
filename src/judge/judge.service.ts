import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { ConfigService } from '../config/config.service';

export interface AnonymizedAnswer {
  label: string;
  content: string;
}

@Injectable()
export class JudgeService {
  private readonly logger = new Logger(JudgeService.name);
  private readonly judgeModel: string;
  private readonly judgeTimeoutMs: number;
  private readonly maxAnswerLength: number;

  constructor(
    private readonly openRouterService: OpenRouterService,
    private readonly configService: ConfigService,
  ) {
    // Load config from ConfigService (backward compatible)
    const config = this.configService.getConfig();
    this.judgeModel = config.judge_model;
    this.judgeTimeoutMs = config.judge_timeout_ms;
    this.maxAnswerLength = config.max_answer_length_for_judge;
  }

  private getJudgeSystemPrompt(isResearchMode: boolean = false): string {
    const basePrompt = `You are an expert synthesis judge. Your task is to create a superior, comprehensive answer by:

1. ANALYZING all provided answers (Answer A, B, C, etc.) from different expert models
2. IDENTIFYING the best insights, facts, and explanations from each
3. SYNTHESIZING them into a single, well-structured response written entirely in YOUR OWN WORDS
4. RESOLVING any contradictions or gaps between answers
5. ENHANCING the response with better organization, clarity, and completeness

CRITICAL REQUIREMENTS:
- DO NOT copy any answer verbatim - rewrite everything in your own voice
- DO NOT simply pick one answer - you must merge and synthesize from ALL answers
- CREATE a response that is BETTER than any individual answer
- STRUCTURE the response clearly with proper formatting (use markdown)
- BE comprehensive - include the best parts from all answers
- RESOLVE conflicts by choosing the most accurate information
- ADD value through better organization and synthesis`;

    if (isResearchMode) {
      return `${basePrompt}

RESEARCH MODE REQUIREMENTS:
- PRIORITIZE research-backed information over model assumptions
- PRESERVE citations from source answers (format: [Source 1], [Source 2], etc.)
- VERIFY facts against provided research context
- BE HONEST about uncertainties - do not hallucinate
- INCLUDE all relevant citations in your final answer
- ENSURE all factual claims are backed by research sources

Your output should be a well-researched, fact-based response with proper citations.`;
    }

    return `${basePrompt}

Your output should be a polished, professional response that demonstrates superior synthesis of all the expert opinions.`;
  }

  private truncateAnswer(answer: string, maxLength: number): string {
    if (answer.length <= maxLength) {
      return answer;
    }
    // Truncate at word boundary
    const truncated = answer.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
  }

  private buildJudgeUserMessage(
    userPrompt: string,
    anonymizedAnswers: AnonymizedAnswer[],
  ): string {
    // Don't truncate - we want the judge to see full answers for better synthesis
    // Only truncate if answer is extremely long (over maxAnswerLength)
    const processedAnswers = anonymizedAnswers.map((answer) => ({
      ...answer,
      content: answer.content.length > this.maxAnswerLength 
        ? this.truncateAnswer(answer.content, this.maxAnswerLength) 
        : answer.content,
    }));

    let message = `USER QUESTION:\n${userPrompt}\n\n`;
    message += `You have received ${processedAnswers.length} expert answers from different AI models. `;
    message += `Your task is to create a superior synthesized response that combines the best elements from all of them.\n\n`;
    message += `EXPERT ANSWERS TO SYNTHESIZE:\n\n`;
    
    processedAnswers.forEach((answer, index) => {
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `${answer.label}:\n`;
      message += `${answer.content}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Now create your synthesized response. Remember:\n`;
    message += `- Write in YOUR OWN WORDS (do not copy)\n`;
    message += `- Synthesize the BEST parts from ALL answers\n`;
    message += `- Create a response that is BETTER than any individual answer\n`;
    message += `- Use clear structure and formatting\n`;

    return message;
  }

  async judgeAndMerge(
    userPrompt: string,
    successfulAnswers: Array<{ model: string; answer: string }>,
    debateRounds?: Array<{ round: number; judgeFeedback: string; answers: Array<{ model: string; answer: string }> }>,
    customJudgeModel?: string,
    isResearchMode: boolean = false,
  ): Promise<string> {
    if (successfulAnswers.length === 0) {
      throw new Error('No successful answers to judge');
    }

    // Anonymize answers - remove model names, assign labels
    const anonymizedAnswers: AnonymizedAnswer[] = successfulAnswers.map(
      (item, index) => ({
        label: `Answer ${String.fromCharCode(65 + index)}`, // A, B, C, ...
        content: item.answer,
      }),
    );

    let systemPrompt = this.getJudgeSystemPrompt(isResearchMode);
    let userMessage = this.buildJudgeUserMessage(userPrompt, anonymizedAnswers);

    // If debate rounds occurred, include them in judge context
    if (debateRounds && debateRounds.length > 0) {
      systemPrompt += `\n\nIMPORTANT: You observed ${debateRounds.length} rounds of iterative debate where models refined their answers based on judge feedback. The final answers below represent evolved, improved versions. Pay special attention to how the models addressed the feedback and incorporated improvements.`;
      
      let debateContext = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      debateContext += `DEBATE EVOLUTION CONTEXT:\n`;
      debateContext += `The models went through ${debateRounds.length} rounds of refinement.\n\n`;
      debateRounds.forEach((round) => {
        debateContext += `Round ${round.round} Judge Feedback: ${round.judgeFeedback}\n\n`;
      });
      debateContext += `The final answers above reflect these refinements.\n`;
      debateContext += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      userMessage = debateContext + userMessage;
    }

    // Use custom judge model if provided, otherwise use default
    const judgeModelToUse = customJudgeModel || this.judgeModel;

    try {
      // Use a higher quality call for judge with better parameters
      const result = await this.openRouterService.callModelWithRetry(
        judgeModelToUse,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        this.judgeTimeoutMs,
        0, // No retries for judge
        {
          temperature: 0.3, // Lower temperature for more focused, quality responses
          max_tokens: 4000, // Allow longer, more comprehensive responses
        },
      );

      return result.response;
    } catch (error) {
      this.logger.error(`Judge model failed: ${error.message}`);
      throw error;
    }
  }
}

