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
    jobId?: string,
  ): Promise<DeepResearchResult> {
    const requestId = jobId || `research-${Date.now()}`;
    this.logger.log(`[${requestId}] ========== DEEP RESEARCH PIPELINE START ==========`);
    this.logger.log(`[${requestId}] Query: "${prompt}"`);
    this.logger.log(`[${requestId}] Models: ${queryModels.map((m) => m.id).join(', ')}`);
    this.logger.log(`[${requestId}] Judge: ${judgeModel.id}`);

    // Step 1: Perform web research
    this.logger.log(`[${requestId}] Step 1/5: Performing web research...`);
    const researchStartTime = Date.now();
    const researchContext = await this.researchService.performResearch(prompt, 8, requestId);
    const researchLatency = Date.now() - researchStartTime;
    
    this.logger.log(`[${requestId}] Research completed in ${researchLatency}ms`);
    this.logger.log(`[${requestId}] Research results: ${researchContext.results.length} sources found`);
    this.logger.log(`[${requestId}] Research citations: ${researchContext.citations.length} URLs`);
    
    if (researchContext.results.length === 0) {
      this.logger.warn(`[${requestId}] ⚠️  WARNING: No research results found! Research summary: "${researchContext.summary}"`);
      this.logger.warn(`[${requestId}] This may indicate: Tavily API key missing, API failure, or no relevant sources`);
    } else {
      this.logger.log(`[${requestId}] ✅ Research successful: Found ${researchContext.results.length} sources`);
      researchContext.results.forEach((r, i) => {
        this.logger.log(`[${requestId}]   Source ${i + 1}: ${r.title} (${r.url})`);
      });
    }

    // Step 2: Format research for models
    this.logger.log(`[${requestId}] Step 2/5: Formatting research context for models...`);
    const researchPrompt = this.researchService.formatResearchForModels(researchContext);
    this.logger.log(`[${requestId}] Research prompt length: ${researchPrompt.length} characters`);

    // Step 3: Get initial answers from models with research context
    this.logger.log(`[${requestId}] Step 3/5: Getting initial model answers with research context...`);
    const modelsStartTime = Date.now();
    const initialAnswers = await this.getResearchedAnswers(
      prompt,
      researchContext,
      queryModels,
      requestId,
    );
    const modelsLatency = Date.now() - modelsStartTime;
    
    this.logger.log(`[${requestId}] Model answers completed in ${modelsLatency}ms`);
    this.logger.log(`[${requestId}] Successful answers: ${initialAnswers.filter((a) => a.answer && a.answer.length > 0).length}/${initialAnswers.length}`);
    
    // Log citations from each model
    initialAnswers.forEach((answer) => {
      const citationCount = answer.citations.length;
      if (citationCount > 0) {
        this.logger.log(`[${requestId}]   ${answer.model}: ${citationCount} citations extracted`);
      } else {
        this.logger.warn(`[${requestId}]   ${answer.model}: No citations extracted (answer length: ${answer.answer.length})`);
      }
    });

    // Step 4: Conduct debate with research context
    this.logger.log(`[${requestId}] Step 4/5: Conducting research-based debate...`);
    
    // Filter out failed answers
    const successfulAnswers = initialAnswers.filter((a) => a.answer && a.answer.length > 0);
    
    if (successfulAnswers.length === 0) {
      this.logger.error(`[${requestId}] ❌ ERROR: No successful model answers for debate`);
      throw new Error('No successful model answers for debate');
    }

    this.logger.log(`[${requestId}] Starting debate with ${successfulAnswers.length} successful answers`);
    const debateResult = await this.debateService.conductIterativeDebate(
      `${prompt}\n\n${researchPrompt}`,
      successfulAnswers.map((a) => ({ model: a.model, answer: a.answer })),
    );
    this.logger.log(`[${requestId}] Debate completed: ${debateResult.debateRounds.length} rounds`);

    // Step 5: Judge merges with emphasis on research-backed answers
    this.logger.log(`[${requestId}] Step 5/5: Judge synthesizing research-backed answer...`);
    const judgeStartTime = Date.now();
    
    // Include research context in the prompt for judge
    const judgePrompt = researchContext.results.length > 0
      ? `${prompt}\n\nResearch Context: ${researchContext.summary}`
      : prompt;
    
    const finalAnswer = await this.judgeService.judgeAndMerge(
      judgePrompt,
      debateResult.finalAnswers,
      debateResult.debateRounds,
      judgeModel.id,
      true, // isResearchMode = true
    );
    const judgeLatency = Date.now() - judgeStartTime;
    this.logger.log(`[${requestId}] Judge synthesis completed in ${judgeLatency}ms`);

    // Step 6: Extract citations from final answer and aggregate from all sources
    this.logger.log(`[${requestId}] Extracting and aggregating citations...`);
    const citations = this.extractAndAggregateCitations(
      finalAnswer,
      researchContext,
      initialAnswers,
    );
    
    this.logger.log(`[${requestId}] Final citations count: ${citations.length}`);
    if (citations.length === 0 && researchContext.results.length > 0) {
      this.logger.warn(`[${requestId}] ⚠️  WARNING: Research sources found (${researchContext.results.length}) but no citations extracted from final answer`);
    }

    this.logger.log(`[${requestId}] ========== DEEP RESEARCH PIPELINE COMPLETE ==========`);

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
    jobId?: string,
  ): Promise<Array<{ model: string; answer: string; citations: string[] }>> {
    const logPrefix = jobId ? `[${jobId}]` : '';
    
    // Build system prompt based on whether research results exist
    let systemPrompt: string;
    if (researchContext.results.length === 0) {
      systemPrompt = `You are a research assistant. Web research was attempted but no results were found.

Your task:
1. Answer the question using your training knowledge
2. Clearly state at the beginning: "Note: No external research results were available for this query."
3. Provide the best answer you can based on your knowledge
4. Be transparent about limitations

CRITICAL: Do not claim to have research results when none were provided.`;
      this.logger.warn(`${logPrefix} No research results - models will use knowledge-only mode`);
    } else {
      systemPrompt = `You are a research assistant. You have been provided with real web research findings.

Your task:
1. Use the research findings to answer the question accurately
2. Base your answer on the provided research, not assumptions
3. Cite sources when referencing specific information using format [Source 1], [Source 2], etc.
4. If research contradicts your knowledge, prioritize the research
5. Be honest about uncertainties
6. You have ${researchContext.results.length} research sources available - use them!

CRITICAL: 
- Do not hallucinate. Only use information from the provided research or clearly state if information is missing.
- Always cite sources when using information from the research context.
- Format citations as [Source 1], [Source 2], etc. where the number corresponds to the source index (1-based).`;
      this.logger.log(`${logPrefix} Research results available - models should cite sources`);
    }

    const formattedResearch = this.researchService.formatResearchForModels(researchContext);
    const userMessage = `${originalPrompt}\n\n${formattedResearch}\n\nProvide a well-researched, fact-based answer with proper citations.`;

    this.logger.log(`${logPrefix} Calling ${queryModels.length} models concurrently with research context...`);

    const promises = queryModels.map(async (model) => {
      const modelStartTime = Date.now();
      try {
        this.logger.log(`${logPrefix} Calling model: ${model.id}`);
        
        const result = await this.openRouterService.callModelWithRetry(
          model.id,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          45000, // Extended timeout for research (45s) - research queries can be complex
          0,
          {
            temperature: 0.3, // Lower temperature for more factual responses
            max_tokens: 3000,
          },
        );

        const modelLatency = Date.now() - modelStartTime;
        this.logger.log(`${logPrefix} Model ${model.id} responded in ${modelLatency}ms (answer length: ${result.response.length})`);

        // Extract citations from answer
        const citations = this.extractCitations(
          result.response,
          researchContext,
        );

        if (citations.length > 0) {
          this.logger.log(`${logPrefix} Model ${model.id} extracted ${citations.length} citations`);
        } else {
          this.logger.warn(`${logPrefix} Model ${model.id} provided answer but no citations extracted`);
        }

        return {
          model: model.id,
          answer: result.response,
          citations,
        };
      } catch (error) {
        const modelLatency = Date.now() - modelStartTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`${logPrefix} Model ${model.id} failed after ${modelLatency}ms: ${errorMessage}`);
        return {
          model: model.id,
          answer: '',
          citations: [],
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Extract citations from a single answer
   */
  private extractCitations(
    answer: string,
    researchContext: ResearchContext,
  ): string[] {
    const citations: string[] = [];
    
    // Try multiple citation patterns
    const patterns = [
      /\[Source\s+(\d+)\]/gi,  // [Source 1]
      /\[(\d+)\]/g,             // [1]
      /\(Source\s+(\d+)\)/gi,   // (Source 1)
      /Source\s+(\d+)/gi,       // Source 1
    ];

    for (const pattern of patterns) {
      const matches = answer.matchAll(pattern);
      for (const match of matches) {
        const sourceIndex = parseInt(match[1]) - 1; // Convert to 0-based
        if (
          sourceIndex >= 0 &&
          sourceIndex < researchContext.results.length
        ) {
          const url = researchContext.results[sourceIndex].url;
          if (url && url.length > 0 && !citations.includes(url)) {
            citations.push(url);
          }
        }
      }
    }

    return citations;
  }

  /**
   * Extract and aggregate citations from final answer and all model answers
   */
  private extractAndAggregateCitations(
    finalAnswer: string,
    researchContext: ResearchContext,
    modelAnswers: Array<{ model: string; answer: string; citations: string[] }>,
  ): string[] {
    const allCitations = new Set<string>();

    // Add citations from final judge answer
    const finalCitations = this.extractCitations(finalAnswer, researchContext);
    finalCitations.forEach((url) => allCitations.add(url));

    // Aggregate citations from all model answers
    modelAnswers.forEach((modelAnswer) => {
      modelAnswer.citations.forEach((url) => {
        if (url && url.length > 0) {
          allCitations.add(url);
        }
      });
    });

    // Also include all research source URLs as citations (they were used in the research)
    researchContext.results.forEach((result) => {
      if (result.url && result.url.length > 0) {
        allCitations.add(result.url);
      }
    });

    return Array.from(allCitations);
  }

  private extractCitationsFromAnswer(
    answer: string,
    researchContext: ResearchContext,
  ): string[] {
    return this.extractCitations(answer, researchContext);
  }
}

