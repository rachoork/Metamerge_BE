import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { MergeController } from './merge/merge.controller';
import { MergeService } from './merge/merge.service';
import { OpenRouterService } from './openrouter/openrouter.service';
import { JudgeService } from './judge/judge.service';
import { LoggerService } from './logger/logger.service';
import { DebateService } from './debate/debate.service';
import { HealthController } from './health/health.controller';
import { ImageGenerationService } from './image-generation/image-generation.service';
import { ResearchService } from './research/research.service';
import { DeepResearchService } from './research/deep-research.service';
import { ConfigService } from './config/config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TerminusModule,
  ],
  controllers: [MergeController, HealthController],
  providers: [
    MergeService,
    OpenRouterService,
    JudgeService,
    LoggerService,
    DebateService,
    ImageGenerationService,
    ResearchService,
    DeepResearchService,
    ConfigService,
  ],
  exports: [ConfigService], // Export for use in other modules
})
export class AppModule {}

