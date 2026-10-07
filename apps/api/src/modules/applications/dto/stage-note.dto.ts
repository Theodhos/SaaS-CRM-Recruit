import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/** What the instructor records for an applicant at one stage: notes plus the pay agreed there. All fields optional. */
export class UpsertStageNoteDto {
  @ApiPropertyOptional({ description: 'What was discussed at this stage' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Agreed pay per hour, in `currency`' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000)
  hourlyRate?: number | null;

  @ApiPropertyOptional({ default: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  hoursPerDay?: number;

  @ApiPropertyOptional({ default: 21, description: 'Working days used for the monthly figure' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  daysPerMonth?: number;

  @ApiPropertyOptional({ description: 'Agency fee as a percentage of the monthly pay' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  feePercent?: number | null;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter code such as USD or EUR' })
  currency?: string;

  @ApiPropertyOptional({
    description: "The stage's own form as key/value pairs (strings, numbers, booleans or null) — e.g. screening result, interview ratings, offer terms, rejection reason",
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown>;
}
