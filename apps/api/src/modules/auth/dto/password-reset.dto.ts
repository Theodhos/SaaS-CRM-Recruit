import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'The token from the link in the e-mail' })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}
