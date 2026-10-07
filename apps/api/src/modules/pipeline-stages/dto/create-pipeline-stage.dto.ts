import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

const PIPELINE_STAGE_TYPES = ['STANDARD', 'PLACED', 'REJECTED'] as const;

export class CreatePipelineStageDto {
  @ApiProperty()
  @IsString()
  pipelineId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Defaults to appended at the end of the pipeline if omitted' })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({ enum: PIPELINE_STAGE_TYPES })
  @IsOptional()
  @IsIn(PIPELINE_STAGE_TYPES)
  type?: (typeof PIPELINE_STAGE_TYPES)[number];
}
