import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * What a website's "apply" form posts. Everything is bounded (length, format) because this endpoint is
 * public: it accepts nothing it does not need, and the global ValidationPipe rejects any extra field.
 */
export class WebsiteApplicationDto {
  @ApiProperty({ description: 'Public identifier (slug) of the agency the application is for', example: 'acme-recruiting' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,58}$/, { message: 'organisation must be a valid organisation slug' })
  organisation!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string;

  @ApiPropertyOptional({ description: 'What the applicant does / the role they are looking for' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  currentCompany?: string;

  @ApiPropertyOptional({
    description:
      'The open job the applicant chose. Optional: an application without a chosen job still lands in Candidates.',
  })
  @IsOptional()
  @Matches(/^c[a-z0-9]{20,}$/i, { message: 'jobId must be a valid job identifier' })
  jobId?: string;

  @ApiPropertyOptional({ description: 'Honeypot: leave empty. Real visitors never see or fill this field; bots do.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
