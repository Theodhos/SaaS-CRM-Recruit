import type { ApplicationSource, ApplicationStatus } from '../common';

import type { SoftDeletableEntity, TenantScopedEntity } from './base';

export interface Application extends TenantScopedEntity, SoftDeletableEntity {
  candidateId: string;
  jobId: string;
  pipelineId: string;
  pipelineStageId: string;
  status: ApplicationStatus;
  source: ApplicationSource;
  ownerId: string | null;
  appliedAt: string;
}
