import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const CONTACT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class ListContactsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches against first/last name, email, job title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ enum: CONTACT_STATUSES })
  @IsOptional()
  @IsIn(CONTACT_STATUSES)
  status?: (typeof CONTACT_STATUSES)[number];
}
