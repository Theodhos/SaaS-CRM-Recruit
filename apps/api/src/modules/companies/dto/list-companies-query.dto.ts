import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const COMPANY_STATUSES = ['PROSPECT', 'ACTIVE_CLIENT', 'FORMER_CLIENT', 'INACTIVE'] as const;

export class ListCompaniesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches against name, industry, email, city' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Only the records this user owns (added)' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ enum: COMPANY_STATUSES })
  @IsOptional()
  @IsIn(COMPANY_STATUSES)
  status?: (typeof COMPANY_STATUSES)[number];
}
