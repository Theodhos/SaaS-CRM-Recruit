import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ description: 'The code from the verification e-mail (6 to 10 digits, see OTP_LENGTH)' })
  @IsString()
  @Matches(/^\d{6,10}$/, { message: 'Invalid verification code.' })
  code!: string;

  @ApiPropertyOptional({ description: 'The challenge token, for clients without cookies. Browsers send it as the httpOnly cookie instead.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  challengeToken?: string;
}

export class ResendOtpDto {
  @ApiPropertyOptional({ description: 'The challenge token, for clients without cookies.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  challengeToken?: string;
}
