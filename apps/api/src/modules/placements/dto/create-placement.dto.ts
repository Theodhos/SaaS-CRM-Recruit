import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

const PLACEMENT_EMPLOYMENT_TYPES = ['PERMANENT', 'TEMPORARY'] as const;
const PLACEMENT_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const;

export class CreatePlacementDto {
  @ApiProperty()
  @IsString()
  candidateId!: string;

  @ApiProperty()
  @IsString()
  jobId!: string;

  @ApiProperty()
  @IsString()
  companyId!: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  /** On an update, null clears it (a contract that was ended by mistake is open again). */
  endDate?: string | null;

  @ApiPropertyOptional({ enum: PLACEMENT_STATUSES })
  @IsOptional()
  @IsIn(PLACEMENT_STATUSES)
  status?: (typeof PLACEMENT_STATUSES)[number];

  @ApiPropertyOptional({ enum: PLACEMENT_EMPLOYMENT_TYPES, description: 'Permanent or temporary employment' })
  @IsOptional()
  @IsIn(PLACEMENT_EMPLOYMENT_TYPES)
  employmentType?: (typeof PLACEMENT_EMPLOYMENT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;
}
