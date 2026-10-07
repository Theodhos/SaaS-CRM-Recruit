import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const USER_STATUSES = ['ACTIVE', 'INVITED', 'SUSPENDED', 'DEACTIVATED'] as const;

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'An existing Role id within this organisation' })
  @IsString()
  roleId!: string;

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: (typeof USER_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Set the initial password directly — omit to auto-generate one instead (returned once in the response).',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'The CRM pages this user works with, as sidebar paths ("/pipeline"). Empty or omitted = every page a member may use.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^\/[a-z0-9-]{1,60}$/, { each: true })
  allowedSections?: string[];

  @ApiPropertyOptional({ description: 'Ask this user for a code sent to their e-mail at every sign-in, after the password.' })
  @IsOptional()
  @IsBoolean()
  loginOtpEnabled?: boolean;
}
