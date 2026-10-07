import type { Company, OffsetPaginatedResult } from '@crm/types';
import type { CreateCompanyInput, UpdateCompanyInput } from '@crm/validation';

import { apiClient } from '@/lib/api-client';

export interface ListCompaniesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  /** Only the companies this user added. */
  ownerId?: string;
}

export type CompanyWithCounts = Company & {
  _count: { jobs: number; candidates: number; contacts: number };
};

export type CompanyDetail = CompanyWithCounts & {
  owner: { id: string; firstName: string; lastName: string } | null;
};

export function listCompanies(params: ListCompaniesParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.ownerId) query.set('ownerId', params.ownerId);

  return apiClient<OffsetPaginatedResult<CompanyWithCounts>>(`/companies?${query.toString()}`);
}

/** Every company the user may see, for the Pipeline Companies board (the list endpoint serves at most 100 per page). */
export async function listAllCompanies(search?: string, ownerId?: string) {
  const items: CompanyWithCounts[] = [];
  for (let page = 1; ; page += 1) {
    const result = await listCompanies({ page, pageSize: 100, search, ownerId });
    items.push(...result.items);
    if (page >= result.totalPages) return items;
  }
}

export function getCompany(id: string) {
  return apiClient<CompanyDetail>(`/companies/${id}`);
}

export function createCompany(input: CreateCompanyInput) {
  return apiClient<Company>('/companies', { method: 'POST', body: input });
}

export function updateCompany(id: string, input: UpdateCompanyInput) {
  return apiClient<Company>(`/companies/${id}`, { method: 'PATCH', body: input });
}

export interface SaveCompanyPipelineRecordInput {
  /** History text by stage — only the stages sent are changed. */
  stages?: Record<string, { notes: string }>;
  pay?: { hourlyRate: number | null; hoursPerDay: number; daysPerMonth: number; feePercent: number | null; currency: string };
}

/** The Pipeline Companies pop-up's Save. */
export function saveCompanyPipelineRecord(id: string, input: SaveCompanyPipelineRecordInput) {
  return apiClient<Pick<Company, 'id' | 'pipelineStage' | 'pipelineRecord'>>(`/companies/${id}/pipeline-record`, { method: 'PUT', body: input });
}

export function deleteCompany(id: string) {
  return apiClient<void>(`/companies/${id}`, { method: 'DELETE' });
}
