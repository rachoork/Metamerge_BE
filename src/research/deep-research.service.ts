import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { ResearchService, ResearchContext } from './research.service';
import { DebateService } from '../debate/debate.service';
import { JudgeService } from '../judge/judge.service';

export interface DeepResearchResult {
  finalAnswer: string;
  citations: string[];
  researchContext: ResearchContext;
  debateRounds: number;
  modelAnswers: Array<{
    model: string;
    answer: string;
    citations: string[];
  }>;
}

@Injectable()
export class DeepResearchService {
  private readonly logger = new Logger(DeepResearchService.name);

  constructor(
    private readonly openRouterService: OpenRouterService,
    private readonly researchService: ResearchService,
    private readonly debateService: DebateService,
    private readonly judgeService: JudgeService,
  ) {}

  async performDeepResearch(
    prompt: string,
    queryModels: Array<{ id: string; name: string; provider: string }>,
    judgeModel: { id: string; name: string; provider: string },
  ): Promise<DeepResearchResult> {
    const requestId = `research-${Date.now()}`;
    this.logger.log(`[${requestId}] Starting deep research for: ${prompt}`);

    // Step 1: Perform web research
    this.logger.log(`[${requestId}] Step 1: Performing web research...`);
    const researchContext = await this.researchService.performResearch(prompt, 8);

    // Step 2: Format research for models
    const researchPrompt = this.researchService.formatResearchForModels(
      researchContext,
    );

    // Step 3: Get initial answers from models with research context
    this.logger.log(`[${requestId}] Step 2: Getting model answers with research...`);
    const initialAnswers = await this.getResearchedAnswers(
      prompt,
      researchContext, // Pass full research context
      queryModels,
    );

    // Step 4: Conduct debate with research context
    this.logger.log(`[${requestId}] Step 3: Conducting research-based debate...`);
    
    // Filter out failed answers
    const successfulAnswers = initialAnswers.filter((a) => a.answer && a.answer.length > 0);
    
    if (successfulAnswers.length === 0) {
      throw new Error('No successful model answers for debate');
    }

    const debateResult = await this.debateService.conductIterativeDebate(
      `${prompt}\n\n${researchPrompt}`,
      successfulAnswers.map((a) => ({ model: a.model, answer: a.answer })),
    );

    // Step 5: Judge merges with emphasis on research-backed answers
    this.logger.log(`[${requestId}] Step 4: Judge synthesizing research-backed answer...`);
    const finalAnswer = await this.judgeService.judgeAndMerge(
      prompt,
      debateResult.finalAnswers,
      debateResult.debateRounds,
      judgeModel.id,
      true, // isResearchMode = true
    );

    // Step 6: Extract citations from final answer
    const citations = this.extractCitations(finalAnswer, researchContext);

    return {
      finalAnswer,
      citations,
      researchContext,
      debateRounds: debateResult.debateRounds.length,
      modelAnswers: initialAnswers,
    };
  }

  private async getResearchedAnswers(
    originalPrompt: string,
    researchContext: ResearchContext,
    queryModels: Array<{ id: string; name: string; provider: string }>,
  ): Promise<Array<{ model: string; answer: string; citations: string[] }>> {
    const systemPrompt = `You are a research assistant. You have been provided with real web research findings.
Your task:
1. Use the research findings to answer the question accurately
2. Base your answer on the provided research, not assumptions
3. Cite sources when referencing specific information
4. If research contradicts your knowledge, prioritize the research
5. Be honest about uncertainties
6. Format citations as [Source 1], [Source 2], etc.

CRITICAL: Do not hallucinate. Only use information from the provided research or clearly state if information is missing.`;

    const formattedResearch = this.researchService.formatResearchForModels(researchContext);
    const userMessage = `${originalPrompt}\n\n${formattedResearch}\n\nProvide a well-researched, fact-based answer with proper citations.`;

    const promises = queryModels.map(async (model) => {
      try {
        const result = await this.openRouterService.callModelWithRetry(
          model.id,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          25000, // Longer timeout for research
          0,
          {
            temperature: 0.3, // Lower temperature for more factual responses
            max_tokens: 3000,
          },
        );

        // Extract citations from answer
        const citations = this.extractCitations(
          result.response,
          researchContext,
        );

        return {
          model: model.id,
          answer: result.response,
          citations,
        };
      } catch (error) {
        this.logger.error(`Model ${model.id} failed: ${error.message}`);
        return {
          model: model.id,
          answer: '',
          citations: [],
        };
      }
    });

    return Promise.all(promises);
  }

  private extractCitations(
    answer: string,
    researchContext: ResearchContext,
  ): string[] {
    const citations: string[] = [];
    const citationPattern = /\[Source\s+(\d+)\]/gi;
    const matches = answer.matchAll(citationPattern);

    for (const match of matches) {
      const sourceIndex = parseInt(match[1]) - 1;
      if (
        sourceIndex >= 0 &&
        sourceIndex < researchContext.results.length
      ) {
        const url = researchContext.results[sourceIndex].url;
        if (url && !citations.includes(url)) {
          citations.push(url);
        }
      }
    }

    return citations;
  }

  private extractCitationsFromAnswer(
    answer: string,
    researchContext: ResearchContext,
  ): string[] {
    return this.extractCitations(answer, researchContext);
  }
}

