import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

const PIPELINE_STAGE_TYPES = ['STANDARD', 'PLACED', 'REJECTED'] as const;

export class UpdatePipelineStageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({ enum: PIPELINE_STAGE_TYPES })
  @IsOptional()
  @IsIn(PIPELINE_STAGE_TYPES)
  type?: (typeof PIPELINE_STAGE_TYPES)[number];
}
