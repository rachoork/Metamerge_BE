import { Injectable } from '@nestjs/common';
import { QueryStrategy } from './query-strategy.interface';
import { TextQueryStrategy } from './text-query.strategy';
import { ImageGenerationService } from '../../image-generation/image-generation.service';
import { DeepResearchService } from '../../research/deep-research.service';

@Injectable()
export class StrategyFactoryService {
  constructor(
    private readonly textStrategy: TextQueryStrategy,
    private readonly imageGenerationService: ImageGenerationService,
    private readonly deepResearchService: DeepResearchService,
  ) {}

  getStrategy(mode?: string): QueryStrategy {
    switch (mode) {
      case 'image-generation':
        return this.imageStrategy;
      case 'deep-research':
        return this.researchStrategy;
      default:
        return this.textStrategy;
    }
  }

  private imageStrategy: QueryStrategy = {
    execute: async (prompt, queryModels, judgeModel) => {
      // Implementation will be moved here
      throw new Error('Image strategy not yet implemented in factory');
    },
  };

  private researchStrategy: QueryStrategy = {
    execute: async (prompt, queryModels, judgeModel) => {
      // Implementation will be moved here
      throw new Error('Research strategy not yet implemented in factory');
    },
  };
}

