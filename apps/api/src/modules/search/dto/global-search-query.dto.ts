import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class GlobalSearchQueryDto {
  @ApiProperty({ description: 'Free-text query, matched against name/title fields across every entity' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q!: string;
}
