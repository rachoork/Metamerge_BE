import { IsString, IsNotEmpty, IsOptional, IsObject, MaxLength } from 'class-validator';

export class DeepResearchOptionsDto {
  @IsOptional()
  depth?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  modelVersion?: string;

  @IsOptional()
  queryModels?: Array<{ id: string; name: string; provider: string }>;

  @IsOptional()
  judgeModel?: { id: string; name: string; provider: string };
}

export class CreateDeepResearchJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000, { message: 'Query cannot exceed 8000 characters' })
  query: string;

  @IsOptional()
  @IsObject()
  options?: DeepResearchOptionsDto;
}

