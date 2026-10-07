import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const CANDIDATE_STATUSES = ['ACTIVE', 'PASSIVE', 'DO_NOT_CONTACT', 'PLACED', 'ARCHIVED'] as const;

/** Where an applicant stands: no application yet (PENDING), one in progress or placed (ACTIVE), or only rejected/withdrawn ones (REJECTED). */
/**
 * PENDING / ACTIVE / REJECTED = where they stand on the pipeline. REAPPLIED = rejected once and now live on another
 * job. SUGGESTED = rejected people for whom an OPEN job similar to the one they were turned down for exists now.
 */
export const REVIEW_STATUSES = ['PENDING', 'ACTIVE', 'REJECTED', 'REAPPLIED', 'SUGGESTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export class ListCandidatesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Matches against first/last name, email, phone, job title, current company',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: CANDIDATE_STATUSES })
  @IsOptional()
  @IsIn(CANDIDATE_STATUSES)
  status?: (typeof CANDIDATE_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Only the records this user owns (added)' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Filter to candidates whose current employer is this Company' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description:
      'Filter to candidates interested in this specific Job — used to rank multiple people competing for the same opening against each other',
  })
  @IsOptional()
  @IsString()
  interestedJobId?: string;

  @ApiPropertyOptional({ enum: REVIEW_STATUSES, description: 'Where the applicant stands: PENDING (no application yet), ACTIVE (application in progress or placed), REJECTED (only rejected/withdrawn applications)' })
  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  reviewStatus?: ReviewStatus;

  @ApiPropertyOptional({
    description: 'Filter to candidates with no Application yet — the unassigned applicant pool',
  })
  @IsOptional()
  // ValidationPipe's enableImplicitConversion already coerces "true"/"false"
  // query strings to real booleans before this runs — comparing against the
  // string 'true' alone silently drops the filter, so both forms are handled.
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unassigned?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter to candidates with at least one Application — the pipeline board\'s "Applicant" filter uses this so it only lists people actually on a board, not the whole candidate pool',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasApplications?: boolean;
}
