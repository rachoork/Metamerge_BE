import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryModelDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  provider: string;
}

export class JudgeModelDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  provider: string;
}

export class MergeRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000, { message: 'Prompt cannot exceed 8000 characters' })
  prompt: string;

  @IsString()
  @IsOptional()
  @IsIn(['comprehensive', 'concise', 'technical', 'creative', 'general', 'query', 'image-generation', 'deep-research'])
  mode?: 'comprehensive' | 'concise' | 'technical' | 'creative' | 'general' | 'query' | 'image-generation' | 'deep-research';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueryModelDto)
  @ArrayMinSize(1, { message: 'At least one query model must be specified' })
  @ArrayMaxSize(10, { message: 'Maximum 10 models allowed' })
  queryModels: QueryModelDto[];

  @ValidateNested()
  @Type(() => JudgeModelDto)
  judgeModel: JudgeModelDto;
}

