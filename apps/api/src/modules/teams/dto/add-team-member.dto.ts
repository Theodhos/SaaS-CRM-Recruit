import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const TEAM_MEMBER_ROLES = ['LEAD', 'MEMBER'] as const;

export class AddTeamMemberDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiPropertyOptional({ enum: TEAM_MEMBER_ROLES, default: 'MEMBER' })
  @IsOptional()
  @IsIn(TEAM_MEMBER_ROLES)
  role?: (typeof TEAM_MEMBER_ROLES)[number];
}

export class UpdateTeamMemberDto {
  @ApiProperty({ enum: TEAM_MEMBER_ROLES })
  @IsIn(TEAM_MEMBER_ROLES)
  role!: (typeof TEAM_MEMBER_ROLES)[number];
}
