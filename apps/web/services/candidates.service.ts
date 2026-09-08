import type { Candidate } from '@crm/types';
import type { OffsetPaginatedResult } from '@crm/types';

import { apiClient } from '@/lib/api-client';

/**
 * Reference implementation of the services/* pattern: one thin function per
 * API operation, typed against @crm/types, with zero UI or state concerns.
 * Add sibling files (companies.service.ts, jobs.service.ts, ...) alongside
 * each feature's Phase 2 implementation — do not pre-build all of them now.
 */
export function listCandidates(params: { page?: number; pageSize?: number } = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  return apiClient<OffsetPaginatedResult<Candidate>>(`/candidates?${query.toString()}`);
}
