import type { Job, OffsetPaginatedResult } from '@crm/types';
import type { CreateJobInput, UpdateJobInput } from '@crm/validation';

import { apiClient } from '@/lib/api-client';

export interface ListJobsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  companyId?: string;
  status?: string;
  /** Only the jobs this user added. */
  ownerId?: string;
}

export type JobWithCompany = Job & {
  company:
    | {
        id: string;
        name: string;
        // the detail endpoint adds the company's own details
        industry?: string | null;
        website?: string | null;
        email?: string | null;
        phone?: string | null;
        city?: string | null;
        country?: string | null;
        status?: string;
      }
    | null;
  /** Detail endpoint only. */
  owner?: { id: string; firstName: string; lastName: string; email: string } | null;
  _count?: { applications: number; placements: number; interestedCandidates: number; documents: number };
};

export function listJobs(params: ListJobsParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.status) query.set('status', params.status);
  if (params.ownerId) query.set('ownerId', params.ownerId);

  return apiClient<OffsetPaginatedResult<JobWithCompany>>(`/jobs?${query.toString()}`);
}

export function getJob(id: string) {
  return apiClient<JobWithCompany>(`/jobs/${id}`);
}

export function createJob(input: CreateJobInput) {
  return apiClient<Job>('/jobs', { method: 'POST', body: input });
}

export function updateJob(id: string, input: UpdateJobInput) {
  return apiClient<Job>(`/jobs/${id}`, { method: 'PATCH', body: input });
}

export function deleteJob(id: string) {
  return apiClient<void>(`/jobs/${id}`, { method: 'DELETE' });
}
