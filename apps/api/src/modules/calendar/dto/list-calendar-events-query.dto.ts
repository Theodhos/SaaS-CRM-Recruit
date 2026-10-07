import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const CALENDAR_EVENT_TYPES = ['MEETING', 'INTERVIEW', 'CALL'] as const;

export class ListCalendarEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches against the event title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: CALENDAR_EVENT_TYPES })
  @IsOptional()
  @IsIn(CALENDAR_EVENT_TYPES)
  type?: (typeof CALENDAR_EVENT_TYPES)[number];

  @ApiPropertyOptional({ description: 'Only events starting on/after this date (month-view range start)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Only events starting on/before this date (month-view range end)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  candidateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  applicationId?: string;
}
