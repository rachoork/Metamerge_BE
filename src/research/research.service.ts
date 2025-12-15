import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  relevanceScore?: number;
}

export interface ResearchContext {
  query: string;
  results: ResearchResult[];
  summary: string;
  citations: string[];
}

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);
  private readonly client: AxiosInstance;
  private readonly tavilyApiKey: string | null;

  constructor() {
    // Try to get Tavily API key (for web search) or use OpenRouter's web search capability
    this.tavilyApiKey = process.env.TAVILY_API_KEY || null;
    
    this.client = axios.create({
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Perform web research using Tavily API or OpenRouter's web search
   */
  async performResearch(
    query: string,
    maxResults: number = 5,
    jobId?: string,
  ): Promise<ResearchContext> {
    const logPrefix = jobId ? `[${jobId}]` : '';
    this.logger.log(`${logPrefix} Starting research for query: "${query}"`);
    this.logger.log(`${logPrefix} Max results: ${maxResults}, Tavily API key: ${this.tavilyApiKey ? 'configured' : 'NOT configured'}`);

    let toolUsed: 'tavily' | 'openrouter' | 'none' = 'none';
    let toolError: string | null = null;
    let results: ResearchResult[] = [];

    try {
      // Try Tavily first if API key is available
      if (this.tavilyApiKey) {
        this.logger.log(`${logPrefix} Attempting Tavily search...`);
        toolUsed = 'tavily';
        results = await this.searchWithTavily(query, maxResults, jobId);
        this.logger.log(`${logPrefix} Tavily search completed. Results: ${results.length}`);
      } else {
        // Fallback: Use OpenRouter's web search capability via a model
        this.logger.warn(`${logPrefix} Tavily API key not configured. Attempting OpenRouter web search fallback...`);
        toolUsed = 'openrouter';
        results = await this.searchWithOpenRouter(query, maxResults, jobId);
        this.logger.log(`${logPrefix} OpenRouter search completed. Results: ${results.length}`);
      }

      // Log research results
      if (results.length === 0) {
        this.logger.warn(`${logPrefix} No research results found for query: "${query}"`);
        this.logger.warn(`${logPrefix} Tool used: ${toolUsed}, Error: ${toolError || 'none'}`);
      } else {
        this.logger.log(`${logPrefix} Research successful: Found ${results.length} sources`);
        results.forEach((result, index) => {
          this.logger.debug(`${logPrefix} Source ${index + 1}: ${result.title} (${result.url})`);
        });
      }

      // Generate summary of research findings
      const summary = this.generateResearchSummary(query, results);
      
      // Extract citations
      const citations = results.map((r) => r.url).filter((url) => url && url.length > 0);

      this.logger.log(`${logPrefix} Research context created: ${results.length} results, ${citations.length} citations`);

      return {
        query,
        results,
        summary,
        citations,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`${logPrefix} Research failed with error: ${errorMessage}`);
      this.logger.error(`${logPrefix} Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
      toolError = errorMessage;

      // Return empty research context on failure, but log it clearly
      this.logger.warn(`${logPrefix} Returning empty research context due to failure`);
      return {
        query,
        results: [],
        summary: `Research unavailable due to error: ${errorMessage}. Proceeding with model knowledge only.`,
        citations: [],
      };
    }
  }

  private async searchWithTavily(
    query: string,
    maxResults: number,
    jobId?: string,
  ): Promise<ResearchResult[]> {
    const logPrefix = jobId ? `[${jobId}]` : '';
    const startTime = Date.now();
    
    try {
      this.logger.log(`${logPrefix} Calling Tavily API with query: "${query}" (maxResults: ${maxResults})`);
      
      const response = await this.client.post(
        'https://api.tavily.com/search',
        {
          api_key: this.tavilyApiKey,
          query,
          search_depth: 'advanced',
          max_results: maxResults,
          include_answer: true,
        },
        {
          timeout: 15000,
        },
      );

      const latency = Date.now() - startTime;
      this.logger.log(`${logPrefix} Tavily API response received in ${latency}ms`);

      // Check response structure
      if (!response.data) {
        this.logger.warn(`${logPrefix} Tavily returned empty response data`);
        return [];
      }

      // Handle Tavily response format
      const rawResults = response.data.results || [];
      this.logger.log(`${logPrefix} Tavily returned ${rawResults.length} raw results`);

      const results: ResearchResult[] = rawResults.map(
        (result: any, index: number) => {
          const mapped = {
            title: result.title || 'Untitled',
            url: result.url || '',
            snippet: result.content || result.snippet || result.raw_content || '',
            source: this.extractDomain(result.url || ''),
            relevanceScore: result.score || 0,
          };

          // Validate result
          if (!mapped.url || mapped.url.length === 0) {
            this.logger.warn(`${logPrefix} Result ${index + 1} missing URL, skipping`);
            return null;
          }

          return mapped;
        },
      ).filter((r: ResearchResult | null) => r !== null) as ResearchResult[];

      this.logger.log(`${logPrefix} Tavily search successful: ${results.length} valid results`);
      return results;
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error(`${logPrefix} Tavily API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          this.logger.error(`${logPrefix} Tavily API network error: No response received`);
        } else {
          this.logger.error(`${logPrefix} Tavily API request error: ${errorMessage}`);
        }
      } else {
        this.logger.error(`${logPrefix} Tavily search failed after ${latency}ms: ${errorMessage}`);
      }
      
      throw error; // Re-throw to be handled by caller
    }
  }

  private async searchWithOpenRouter(
    query: string,
    maxResults: number,
    jobId?: string,
  ): Promise<ResearchResult[]> {
    const logPrefix = jobId ? `[${jobId}]` : '';
    
    // Use a model with web search capability via OpenRouter
    // This is a fallback if Tavily is not available
    // Note: This requires models that support web search/tool use
    
    this.logger.warn(`${logPrefix} OpenRouter web search not yet implemented. Tavily API key recommended.`);
    this.logger.warn(`${logPrefix} Returning empty results - research will proceed without external sources`);
    
    // TODO: Implement OpenRouter web search using models with tool use capability
    // For now, return empty array which will trigger "no research results" path
    return [];
  }

  private generateResearchSummary(
    query: string,
    results: ResearchResult[],
  ): string {
    if (results.length === 0) {
      return `No research results found for "${query}". This may indicate:
1. The search service is unavailable or not configured
2. No relevant sources were found for this query
3. A temporary error occurred during the search

Proceeding with model knowledge only.`;
    }

    let summary = `Research findings for "${query}":\n\n`;
    results.forEach((result, index) => {
      summary += `[Source ${index + 1}] ${result.title}\n`;
      summary += `URL: ${result.url}\n`;
      summary += `Source: ${result.source}\n`;
      const snippet = result.snippet || '';
      summary += `Content: ${snippet.substring(0, 300)}${snippet.length > 300 ? '...' : ''}\n\n`;
    });

    return summary;
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Unknown source';
    }
  }

  /**
   * Format research context for model consumption
   */
  formatResearchForModels(research: ResearchContext): string {
    let formatted = `RESEARCH CONTEXT:\n`;
    formatted += `Query: ${research.query}\n\n`;
    formatted += `Research Summary:\n${research.summary}\n\n`;
    
    if (research.results.length > 0) {
      formatted += `Detailed Sources:\n`;
      research.results.forEach((result, index) => {
        formatted += `\n[${index + 1}] ${result.title}\n`;
        formatted += `URL: ${result.url}\n`;
        formatted += `Content: ${result.snippet}\n`;
      });
    }

    formatted += `\nIMPORTANT: Use this research to provide accurate, fact-based answers. Cite sources when referencing specific information.`;
    
    return formatted;
  }
}

