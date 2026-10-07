import type { Document, OffsetPaginatedResult, Placement } from '@crm/types';
import type { CreatePlacementInput, UpdatePlacementInput } from '@crm/validation';

import { apiClient } from '@/lib/api-client';

export interface ListPlacementsParams {
  /** Only the records this user added (the admin's "Added by" filter). */
  ownerId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  employmentType?: 'PERMANENT' | 'TEMPORARY';
  candidateId?: string;
  jobId?: string;
  companyId?: string;
}

export type PlacementWithRelations = Placement & {
  candidate: { id: string; firstName: string; lastName: string };
  job: { id: string; title: string };
  company: { id: string; name: string };
  documents: Document[];
};

export function listPlacements(params: ListPlacementsParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.ownerId) query.set('ownerId', params.ownerId);
  if (params.status) query.set('status', params.status);
  if (params.employmentType) query.set('employmentType', params.employmentType);
  if (params.candidateId) query.set('candidateId', params.candidateId);
  if (params.jobId) query.set('jobId', params.jobId);
  if (params.companyId) query.set('companyId', params.companyId);

  return apiClient<OffsetPaginatedResult<PlacementWithRelations>>(`/placements?${query.toString()}`);
}

export function getPlacement(id: string) {
  return apiClient<PlacementWithRelations>(`/placements/${id}`);
}

export function createPlacement(input: CreatePlacementInput) {
  return apiClient<PlacementWithRelations>('/placements', { method: 'POST', body: input });
}

export function updatePlacement(id: string, input: UpdatePlacementInput) {
  return apiClient<PlacementWithRelations>(`/placements/${id}`, { method: 'PATCH', body: input });
}

export function deletePlacement(id: string) {
  return apiClient<void>(`/placements/${id}`, { method: 'DELETE' });
}
