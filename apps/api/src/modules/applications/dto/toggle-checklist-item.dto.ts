import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleChecklistItemDto {
  @ApiProperty()
  @IsBoolean()
  completed!: boolean;
}
