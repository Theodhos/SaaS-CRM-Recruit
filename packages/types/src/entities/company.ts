import type { CompanyPipelineStage, CompanyStatus } from '../common';

import type { SoftDeletableEntity, TenantScopedEntity } from './base';

export interface Company extends TenantScopedEntity, SoftDeletableEntity {
  name: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  status: CompanyStatus;
  pipelineStage: CompanyPipelineStage;
  /** Free text about the company (where it operates, its services, …). */
  about: string | null;
  ownerId: string | null;
  /** What the Pipeline Companies pop-up keeps for the company. */
  pipelineRecord?: CompanyPipelineRecord;
}

export interface CompanyStageRecord {
  /** What was written while the company was in this stage. */
  notes: string;
  updatedAt: string | null;
  /** When the company (last) entered the stage. */
  enteredAt: string | null;
}

export interface CompanyPay {
  hourlyRate: number | null;
  hoursPerDay: number;
  daysPerMonth: number;
  feePercent: number | null;
  currency: string;
}

export interface CompanyPipelineRecord {
  stages?: Partial<Record<CompanyPipelineStage, CompanyStageRecord>>;
  pay?: CompanyPay | null;
}
