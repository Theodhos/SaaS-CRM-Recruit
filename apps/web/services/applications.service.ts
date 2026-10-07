import type { Application, OffsetPaginatedResult } from '@crm/types';
import type { CreateApplicationInput, UpdateApplicationInput } from '@crm/validation';

import { apiClient } from '@/lib/api-client';

export interface ListApplicationsParams {
  /** Only the records this user added (the admin's "Added by" filter). */
  ownerId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  candidateId?: string;
  jobId?: string;
  companyId?: string;
  pipelineId?: string;
  /** Pay filter (pipeline board): the hourly rate recorded in the applicant's stage notes. */
  minHourlyRate?: number;
  maxHourlyRate?: number;
  /** Date filter (pipeline board): only applications added between these moments (ISO date-times). */
  appliedFrom?: string;
  appliedTo?: string;
}

/** A per-stage record of the applicant (see features/pipelines/stage-forms.ts) as the list carries it. Decimals arrive as strings. */
export interface ApplicationStageRecord {
  pipelineStageId: string;
  notes: string | null;
  fields: Record<string, string | number | boolean | null>;
  hourlyRate: string | number | null;
  hoursPerDay: number;
  daysPerMonth: number;
  feePercent: string | number | null;
  currency: string;
  updatedAt: string;
}

export interface ApplicationChecklistResponse {
  id: string;
  checklistItemId: string;
  completed: boolean;
  completedAt: string | null;
}

export type ApplicationWithRelations = Application & {
  candidate: { id: string; firstName: string; lastName: string; email: string | null; status: string };
  job: { id: string; title: string; status: string; company: { id: string; name: string } };
  pipelineStage: { id: string; name: string; type: string; order: number };
  checklistResponses: ApplicationChecklistResponse[];
  /** Newest first. */
  stageNotes?: ApplicationStageRecord[];
};

export function listApplications(params: ListApplicationsParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.ownerId) query.set('ownerId', params.ownerId);
  if (params.status) query.set('status', params.status);
  if (params.candidateId) query.set('candidateId', params.candidateId);
  if (params.jobId) query.set('jobId', params.jobId);
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.pipelineId) query.set('pipelineId', params.pipelineId);
  if (params.minHourlyRate !== undefined) query.set('minHourlyRate', String(params.minHourlyRate));
  if (params.maxHourlyRate !== undefined) query.set('maxHourlyRate', String(params.maxHourlyRate));
  if (params.appliedFrom) query.set('appliedFrom', params.appliedFrom);
  if (params.appliedTo) query.set('appliedTo', params.appliedTo);

  return apiClient<OffsetPaginatedResult<ApplicationWithRelations>>(`/applications?${query.toString()}`);
}

export function getApplication(id: string) {
  return apiClient<ApplicationWithRelations>(`/applications/${id}`);
}

export function createApplication(input: CreateApplicationInput) {
  return apiClient<ApplicationWithRelations>('/applications', { method: 'POST', body: input });
}

export function updateApplication(id: string, input: UpdateApplicationInput) {
  return apiClient<ApplicationWithRelations>(`/applications/${id}`, { method: 'PATCH', body: input });
}

export function deleteApplication(id: string) {
  return apiClient<void>(`/applications/${id}`, { method: 'DELETE' });
}

export function toggleChecklistItem(applicationId: string, checklistItemId: string, completed: boolean) {
  return apiClient<ApplicationChecklistResponse>(
    `/applications/${applicationId}/checklist-items/${checklistItemId}`,
    { method: 'PATCH', body: { completed } },
  );
}
