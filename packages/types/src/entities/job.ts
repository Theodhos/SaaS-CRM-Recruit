import type { EmploymentType, JobStatus } from '../common';

import type { SoftDeletableEntity, TenantScopedEntity } from './base';

export interface Job extends TenantScopedEntity, SoftDeletableEntity {
  companyId: string | null;
  title: string;
  description: string | null;
  responsibilities: string | null;
  requirements: string | null;
  experienceYearsMin: number | null;
  experienceYearsMax: number | null;
  location: string | null;
  employmentType: EmploymentType;
  salaryMin: string | null;
  salaryMax: string | null;
  currency: string;
  compensationPackage: string | null;
  status: JobStatus;
  ownerId: string | null;
  openedAt: string;
  closedAt: string | null;
}
