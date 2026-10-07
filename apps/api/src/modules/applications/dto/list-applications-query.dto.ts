import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn,IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const APPLICATION_STATUSES = ['ACTIVE', 'ON_HOLD', 'REJECTED', 'WITHDRAWN', 'PLACED'] as const;

export class ListApplicationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Matches against the candidate's name or the job's title" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: APPLICATION_STATUSES })
  @IsOptional()
  @IsIn(APPLICATION_STATUSES)
  status?: (typeof APPLICATION_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Only the records this user owns (added)' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  candidateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional({ description: "Filters by the application's job's companyId" })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Filters to applications on this pipeline — the pipeline board is always scoped to one pipeline at a time' })
  @IsOptional()
  @IsString()
  pipelineId?: string;

  // Pay filter for the pipeline board: matches the hourly rate recorded in the applicant's stage notes (any stage).
  @ApiPropertyOptional({ description: 'Only applicants whose recorded pay is at least this hourly rate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minHourlyRate?: number;

  @ApiPropertyOptional({ description: 'Only applicants whose recorded pay is at most this hourly rate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxHourlyRate?: number;

  // Date filter for the pipeline board: when the application was added (appliedAt), both ends included.
  @ApiPropertyOptional({ description: 'Only applications added at or after this moment (ISO date-time)' })
  @IsOptional()
  @IsDateString()
  appliedFrom?: string;

  @ApiPropertyOptional({ description: 'Only applications added at or before this moment (ISO date-time)' })
  @IsOptional()
  @IsDateString()
  appliedTo?: string;
}
