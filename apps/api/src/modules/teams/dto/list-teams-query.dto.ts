import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListTeamsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches against the team name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
