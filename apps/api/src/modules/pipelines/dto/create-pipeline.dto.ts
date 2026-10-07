import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

import { PipelineStageInputDto } from './pipeline-stage-input.dto';

/** What the scheme's placed candidates become (mirrors PlacementEmploymentType). */
export const PIPELINE_EMPLOYMENT_TYPES = ['PERMANENT', 'TEMPORARY'] as const;

export class CreatePipelineDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: PIPELINE_EMPLOYMENT_TYPES, default: 'PERMANENT', description: 'Placed candidates become permanent or temporary employees' })
  @IsOptional()
  @IsIn(PIPELINE_EMPLOYMENT_TYPES)
  employmentType?: (typeof PIPELINE_EMPLOYMENT_TYPES)[number];

  @ApiProperty({
    type: [PipelineStageInputDto],
    description: 'At least one stage — a pipeline with no stages has nowhere for an application to sit.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PipelineStageInputDto)
  stages!: PipelineStageInputDto[];
}
