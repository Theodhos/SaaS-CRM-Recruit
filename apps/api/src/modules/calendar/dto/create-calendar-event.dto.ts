import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const CALENDAR_EVENT_TYPES = ['MEETING', 'INTERVIEW', 'CALL'] as const;
const CALENDAR_EVENT_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;

export class CreateCalendarEventDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ enum: CALENDAR_EVENT_TYPES })
  @IsOptional()
  @IsIn(CALENDAR_EVENT_TYPES)
  type?: (typeof CALENDAR_EVENT_TYPES)[number];

  @ApiProperty()
  @IsDateString()
  startAt!: string;

  @ApiProperty()
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @ApiPropertyOptional({ description: 'An http(s) link — it is shown as a link on the calendar and on the pipeline' })
  @ValidateIf((event: { meetingUrl?: string | null }) => event.meetingUrl !== undefined && event.meetingUrl !== null && event.meetingUrl !== '')
  @IsString()
  @MaxLength(500)
  @Matches(/^https?:\/\/\S+$/i, { message: 'meetingUrl must be an http(s) link' })
  meetingUrl?: string;

  @ApiPropertyOptional({ enum: CALENDAR_EVENT_STATUSES })
  @IsOptional()
  @IsIn(CALENDAR_EVENT_STATUSES)
  status?: (typeof CALENDAR_EVENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Defaults to the current user if omitted' })
  @IsOptional()
  @IsString()
  userId?: string;

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
