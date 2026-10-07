import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class CreateChecklistItemDto {
  @ApiProperty({ description: 'The question/test/task this stage requires, e.g. "Technical screen passed"' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional({ description: 'Defaults to appended at the end of the stage\'s checklist if omitted' })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;
}
