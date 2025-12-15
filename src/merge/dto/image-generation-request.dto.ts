import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ImageModelDto {
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

export class ImageGenerationRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000, { message: 'Prompt cannot exceed 8000 characters' })
  prompt: string;

  // Accept imageModels (primary field name)
  // Transform will normalize queryModels to imageModels if needed
  @Transform(({ obj }) => {
    // If imageModels is provided, use it; otherwise use queryModels
    return obj.imageModels || obj.queryModels;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageModelDto)
  @ArrayMinSize(1, { message: 'At least one image model must be specified' })
  @ArrayMaxSize(10, { message: 'Maximum 10 models allowed' })
  imageModels: ImageModelDto[];

  // Also accept queryModels for UI compatibility
  // This field is whitelisted but not validated (Transform handles it)
  @IsOptional()
  queryModels?: ImageModelDto[];

  @IsOptional()
  @IsString()
  size?: string; // e.g., "1024x1024", "512x512"

  @IsOptional()
  @IsString()
  responseFormat?: 'url' | 'b64_json'; // Default: 'url'
}
