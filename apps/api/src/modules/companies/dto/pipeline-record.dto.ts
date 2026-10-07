import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

/**
 * What the Pipeline Companies pop-up saves for a company. Both parts are free-form objects from the web app, so
 * their contents are checked in CompaniesService (see `savePipelineRecord`) rather than trusted.
 */
export class SaveCompanyPipelineRecordDto {
  @ApiPropertyOptional({ description: 'History text by stage: { NEW: { notes }, IN_CONVERSATION: { notes }, … } — only the stages sent are changed' })
  @IsOptional()
  @IsObject()
  stages?: Record<string, { notes?: unknown }>;

  @ApiPropertyOptional({ description: 'The pay calculation: { hourlyRate, hoursPerDay, daysPerMonth, feePercent, currency }' })
  @IsOptional()
  @IsObject()
  pay?: Record<string, unknown>;
}
