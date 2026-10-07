import type { PlacementStatus } from '../common';

import type { TenantScopedEntity } from './base';

export interface Placement extends TenantScopedEntity {
  candidateId: string;
  jobId: string;
  companyId: string;
  startDate: string;
  endDate: string | null;
  status: PlacementStatus;
  employmentType: 'PERMANENT' | 'TEMPORARY';
  ownerId: string | null;
}
