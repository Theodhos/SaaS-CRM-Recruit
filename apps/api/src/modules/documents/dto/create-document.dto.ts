import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const DOCUMENT_TYPES = ['CV', 'RESUME', 'COVER_LETTER', 'CONTRACT', 'OFFER_LETTER', 'OTHER'] as const;

/**
 * Metadata sent alongside the file in a multipart/form-data request (see
 * DocumentsController.upload) — the file itself is handled separately by
 * FileInterceptor, never through class-validator.
 */
export class CreateDocumentDto {
  @ApiPropertyOptional({ description: 'Defaults to the uploaded file name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_TYPES })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  type?: (typeof DOCUMENT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  applicationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  candidateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placementId?: string;
}
