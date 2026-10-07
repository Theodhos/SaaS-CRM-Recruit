import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

const JOB_STATUSES = ['OPEN', 'ON_HOLD', 'CLOSED'] as const;
const EMPLOYMENT_TYPES = ['PERMANENT', 'CONTRACT', 'TEMPORARY', 'PART_TIME'] as const;

export class CreateJobDto {
  @ApiPropertyOptional({ description: 'Link to an existing Company by id — omit if unknown yet' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description:
      'Free-text company name, resolved the same way as Candidate.currentCompany: matched to an existing Company by name or a new one is created. Ignored if companyId is also set.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @ApiPropertyOptional({ description: 'What the candidate will do in the job, one duty per line' })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  responsibilities?: string;

  @ApiPropertyOptional({ description: 'What the job asks of the candidate, one requirement per line' })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  requirements?: string;

  @ApiPropertyOptional({ description: 'Years of experience asked for (null clears it)', nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYearsMin?: number | null;

  @ApiPropertyOptional({
    description: 'Upper end of the experience range; leave empty for "at least min" (null clears it)',
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYearsMax?: number | null;

  @ApiPropertyOptional({
    description: 'The pay package beyond the salary range: bonus, benefits, allowances, leave — one item per line',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  compensationPackage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string;

  @ApiPropertyOptional({ enum: EMPLOYMENT_TYPES })
  @IsOptional()
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: (typeof EMPLOYMENT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: JOB_STATUSES })
  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: (typeof JOB_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;
}
