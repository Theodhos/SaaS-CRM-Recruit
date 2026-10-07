import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

const PIPELINE_STAGE_TYPES = ['STANDARD', 'PLACED', 'REJECTED'] as const;

/** One stage inside a Pipeline's nested `stages` create payload — no `pipelineId` here, the parent carries it. */
export class PipelineStageInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Position within the pipeline, 1-based' })
  @IsInt()
  @Min(1)
  order!: number;

  @ApiPropertyOptional({
    enum: PIPELINE_STAGE_TYPES,
    description:
      'STANDARD (default) for an in-progress stage. PLACED marks the stage that auto-creates a Placement when an application reaches it. REJECTED marks a terminal drop-out stage.',
  })
  @IsOptional()
  @IsIn(PIPELINE_STAGE_TYPES)
  type?: (typeof PIPELINE_STAGE_TYPES)[number];
}
