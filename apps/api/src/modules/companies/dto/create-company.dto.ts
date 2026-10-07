import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

const COMPANY_STATUSES = ['PROSPECT', 'ACTIVE_CLIENT', 'FORMER_CLIENT', 'INACTIVE'] as const;
export const COMPANY_PIPELINE_STAGES = ['NEW', 'IN_CONVERSATION', 'WIN', 'LOST'] as const;

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(300)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  country?: string;

  @ApiPropertyOptional({ enum: COMPANY_STATUSES })
  @IsOptional()
  @IsIn(COMPANY_STATUSES)
  status?: (typeof COMPANY_STATUSES)[number];

  @ApiPropertyOptional({ enum: COMPANY_PIPELINE_STAGES, description: 'Column on the Pipeline Companies board' })
  @IsOptional()
  @IsIn(COMPANY_PIPELINE_STAGES)
  pipelineStage?: (typeof COMPANY_PIPELINE_STAGES)[number];

  @ApiPropertyOptional({ description: 'Free text about the company: where it operates, the services it offers, …' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  about?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;
}
