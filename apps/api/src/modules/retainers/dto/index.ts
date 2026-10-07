import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const RETAINER_STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED'] as const;
export type RetainerStatusValue = (typeof RETAINER_STATUSES)[number];

export class CreateRetainerDto {
  @ApiProperty({ description: 'The client company that pays the retainer' })
  @IsString()
  companyId!: string;

  @ApiProperty({ description: 'What the company pays per month' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999)
  amount!: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ description: 'Last day of the agreement. Left out = open-ended.' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: RETAINER_STATUSES, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(RETAINER_STATUSES)
  status?: RetainerStatusValue;
}

export class UpdateRetainerDto extends PartialType(CreateRetainerDto) {}

export class RenewRetainerDto {
  @ApiProperty({ description: 'How many months the agreement is extended by' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  months!: number;

  @ApiPropertyOptional({ description: 'The monthly amount from the renewal on. Left out = unchanged.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999)
  amount?: number;
}

export class ListRetainersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RETAINER_STATUSES })
  @IsOptional()
  @IsIn(RETAINER_STATUSES)
  status?: RetainerStatusValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;
}
