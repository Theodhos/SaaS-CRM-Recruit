import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class ScheduleInterviewDto {
  @ApiProperty({ description: 'The application (pipeline card) the interview is for' })
  @IsString()
  applicationId!: string;

  @ApiProperty({ description: 'ISO 8601 date-time of the slot' })
  @IsISO8601()
  scheduledAt!: string;

  @ApiPropertyOptional({ default: 45, minimum: 15, maximum: 480 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes: number = 45;

  @ApiPropertyOptional({ description: 'IANA time zone the slot was picked in (e.g. Europe/Tirane) — used in the e-mail and for the Zoom meeting' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ description: 'A meeting link to use instead of creating one through Zoom (e.g. your Personal Meeting Room)' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  meetingUrl?: string;

  @ApiPropertyOptional({ description: 'Agenda / message included in the invitation' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ default: true, description: 'E-mail the invitation to the candidate' })
  @IsOptional()
  @IsBoolean()
  sendInvite: boolean = true;
}

/** One of the three: interviews of an application, of every application of a candidate, or of a job. */
export class ListInterviewsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  applicationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  candidateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;
}
