import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const FEE_STATUSES = ['PENDING', 'INVOICED', 'PAID', 'OVERDUE', 'CANCELLED'] as const;
export type FeeStatusValue = (typeof FEE_STATUSES)[number];

export class CreateFeeDto {
  @ApiProperty({ description: 'The Active Employees entry (placement) this fee is charged for' })
  @IsString()
  placementId!: string;

  @ApiProperty()
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

  @ApiPropertyOptional({ enum: FEE_STATUSES, default: 'PENDING' })
  @IsOptional()
  @IsIn(FEE_STATUSES)
  status?: FeeStatusValue;

  @ApiPropertyOptional({ description: 'When the client has to pay by' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateFeeDto extends PartialType(CreateFeeDto) {}

export class ListFeesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FEE_STATUSES })
  @IsOptional()
  @IsIn(FEE_STATUSES)
  status?: FeeStatusValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placementId?: string;
}
