import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

/** The values the pay calculation starts from, for the whole organisation. */
export class PayDefaultsDto {
  @ApiPropertyOptional({ description: 'ISO code, e.g. EUR' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  hoursPerDay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  daysPerMonth?: number;

  @ApiPropertyOptional({ description: 'The agency fee, % of the monthly pay' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  feePercent?: number;

  @ApiPropertyOptional({ description: 'Days a client has to pay a fee in' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermDays?: number;
}

export class UpdateOrganisationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ type: PayDefaultsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PayDefaultsDto)
  payDefaults?: PayDefaultsDto;
}
