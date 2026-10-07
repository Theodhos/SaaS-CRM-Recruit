import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'INTERVIEW', 'NOTE', 'FOLLOW_UP', 'STATUS_CHANGE'] as const;

export class ListActivitiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches against subject/description' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ACTIVITY_TYPES })
  @IsOptional()
  @IsIn(ACTIVITY_TYPES)
  type?: (typeof ACTIVITY_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  candidateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  applicationId?: string;
}
