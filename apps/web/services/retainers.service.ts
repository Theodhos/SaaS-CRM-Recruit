import type { OffsetPaginatedResult } from '@crm/types';

import { apiClient } from '@/lib/api-client';

import type { MoneyTotals } from './fees.service';

export type RetainerStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface Retainer {
  id: string;
  companyId: string;
  /** What the company pays per month. */
  amount: number;
  currency: string;
  status: RetainerStatus;
  startDate: string;
  /** Null = open-ended. */
  endDate: string | null;
  daysLeft: number | null;
  /** Active, and 30 days or fewer are left: time to talk about renewing. */
  endsSoon: boolean;
  createdAt: string;
  company: { id: string; name: string; pipelineStage: string; status: string; _count: { jobs: number; placements: number } };
  renewals: { id: string; renewalDate: string; amount: number; status: string; createdAt: string }[];
}

export interface RetainersOverview {
  active: number;
  perMonth: MoneyTotals;
  endingSoon: number;
  expired: number;
  /** Won clients (Pipeline Companies → Win) with no agreement running. */
  withoutRetainer: { id: string; name: string; jobs: number; employees: number }[];
}

export interface ListRetainersParams {
  page?: number;
  pageSize?: number;
  status?: RetainerStatus;
  companyId?: string;
}

export interface RetainerInput {
  companyId: string;
  amount: number;
  currency?: string;
  startDate: string;
  endDate?: string | null;
  status?: RetainerStatus;
}

export function listRetainers(params: ListRetainersParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.status) query.set('status', params.status);
  if (params.companyId) query.set('companyId', params.companyId);

  return apiClient<OffsetPaginatedResult<Retainer>>(`/retainers?${query.toString()}`);
}

export function getRetainersOverview() {
  return apiClient<RetainersOverview>('/retainers/overview');
}

export function createRetainer(input: RetainerInput) {
  return apiClient<Retainer>('/retainers', { method: 'POST', body: input });
}

export function updateRetainer(id: string, input: Partial<RetainerInput>) {
  return apiClient<Retainer>(`/retainers/${id}`, { method: 'PATCH', body: input });
}

export function renewRetainer(id: string, input: { months: number; amount?: number }) {
  return apiClient<Retainer>(`/retainers/${id}/renew`, { method: 'POST', body: input });
}

export function deleteRetainer(id: string) {
  return apiClient<void>(`/retainers/${id}`, { method: 'DELETE' });
}
