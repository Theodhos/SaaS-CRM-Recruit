import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { DEFAULT_COUNTRY_CODES } from '../lib/phone-number';

/** List filters: who was never called, who was called, and how the last call went. */
export const CALL_FILTERS = ['ALL', 'NEVER_CALLED', 'CALLED', 'ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED'] as const;
export type CallFilter = (typeof CALL_FILTERS)[number];

export class ListPhonesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches phone (any formatting), name, e-mail or company' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: CALL_FILTERS, default: 'ALL' })
  @IsOptional()
  @IsIn(CALL_FILTERS)
  callFilter?: CallFilter;

  @ApiPropertyOptional({ description: 'Numbers linked to this candidate (candidate profile)' })
  @IsOptional()
  @IsString()
  candidateId?: string;

  @ApiPropertyOptional({ description: 'Numbers linked to this company' })
  @IsOptional()
  @IsString()
  companyId?: string;
}

/** Multipart fields next to the CSV file. */
export class ImportPreviewDto {
  @ApiPropertyOptional({ enum: DEFAULT_COUNTRY_CODES, default: 'AL', description: 'Country assumed for national numbers (069… -> +35569…)' })
  @IsOptional()
  @IsIn(DEFAULT_COUNTRY_CODES)
  defaultCountry?: string;
}

export const BROWSER_CALL_STATUSES = ['RINGING', 'ANSWERED', 'ENDED', 'NO_ANSWER', 'BUSY', 'FAILED', 'REJECTED'] as const;

/** What the browser reports about a call it is running (the provider webhook is the source of truth when reachable). */
export class UpdateCallDto {
  @ApiPropertyOptional({ enum: BROWSER_CALL_STATUSES })
  @IsOptional()
  @IsIn(BROWSER_CALL_STATUSES)
  status?: (typeof BROWSER_CALL_STATUSES)[number];

  @ApiPropertyOptional({ description: 'When the far end picked up (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  answeredAt?: string;

  @ApiPropertyOptional({ description: 'When the call ended (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  endedAt?: string;

  @ApiPropertyOptional({ description: 'Talk time in seconds, if the browser measured it' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({ description: 'What was said — becomes part of the phone’s history' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class TwimlRequestDto {
  @ApiProperty() To?: string;
  @ApiProperty() CallId?: string;
  @ApiProperty() CallSid?: string;
  From?: string;
}
