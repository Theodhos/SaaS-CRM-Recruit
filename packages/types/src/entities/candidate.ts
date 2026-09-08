import type { CandidateStatus } from '../common';

import type { SoftDeletableEntity, TenantScopedEntity } from './base';

/**
 * Reference implementation of the entity-type pattern. One file per domain
 * entity, mirroring its Prisma model but expressed as a plain, frontend-safe
 * interface (dates as ISO strings, no Prisma-generated types). Add sibling
 * files (company.ts, job.ts, application.ts, ...) here as each module is
 * implemented in Phase 2 — do not pre-build all of them speculatively now.
 */
export interface Candidate extends TenantScopedEntity, SoftDeletableEntity {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  jobTitle: string | null;
  currentCompany: string | null;
  source: string | null;
  avatarUrl: string | null;
  status: CandidateStatus;
  ownerId: string | null;
}
