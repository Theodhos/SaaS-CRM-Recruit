import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { PIPELINE_EMPLOYMENT_TYPES } from './create-pipeline.dto';

export class UpdatePipelineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: PIPELINE_EMPLOYMENT_TYPES, description: 'Placed candidates become permanent or temporary employees' })
  @IsOptional()
  @IsIn(PIPELINE_EMPLOYMENT_TYPES)
  employmentType?: (typeof PIPELINE_EMPLOYMENT_TYPES)[number];
}
