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
  ): Promise<ResearchContext> {
    this.logger.log(`Starting research for query: ${query}`);

    try {
      let results: ResearchResult[] = [];

      // Try Tavily first if API key is available
      if (this.tavilyApiKey) {
        results = await this.searchWithTavily(query, maxResults);
      } else {
        // Fallback: Use OpenRouter's web search capability via a model
        results = await this.searchWithOpenRouter(query, maxResults);
      }

      // Generate summary of research findings
      const summary = this.generateResearchSummary(query, results);
      
      // Extract citations
      const citations = results.map((r) => r.url);

      return {
        query,
        results,
        summary,
        citations,
      };
    } catch (error) {
      this.logger.error(`Research failed: ${error.message}`);
      // Return empty research context on failure
      return {
        query,
        results: [],
        summary: 'Research unavailable. Proceeding with model knowledge only.',
        citations: [],
      };
    }
  }

  private async searchWithTavily(
    query: string,
    maxResults: number,
  ): Promise<ResearchResult[]> {
    try {
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

      const results: ResearchResult[] = (response.data.results || []).map(
        (result: any) => ({
          title: result.title || 'Untitled',
          url: result.url || '',
          snippet: result.content || result.snippet || '',
          source: this.extractDomain(result.url || ''),
          relevanceScore: result.score || 0,
        }),
      );

      return results;
    } catch (error) {
      this.logger.warn(`Tavily search failed: ${error.message}`);
      return [];
    }
  }

  private async searchWithOpenRouter(
    query: string,
    maxResults: number,
  ): Promise<ResearchResult[]> {
    // Use a model with web search capability via OpenRouter
    // This is a fallback if Tavily is not available
    // Note: This requires models that support web search/tool use
    
    // For now, return empty - can be enhanced with actual web search models
    this.logger.warn('OpenRouter web search not yet implemented. Tavily API key recommended.');
    return [];
  }

  private generateResearchSummary(
    query: string,
    results: ResearchResult[],
  ): string {
    if (results.length === 0) {
      return 'No research results found.';
    }

    let summary = `Research findings for "${query}":\n\n`;
    results.forEach((result, index) => {
      summary += `${index + 1}. ${result.title}\n`;
      summary += `   Source: ${result.source}\n`;
      summary += `   ${result.snippet.substring(0, 200)}...\n\n`;
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

