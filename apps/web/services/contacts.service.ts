import type { Contact, OffsetPaginatedResult } from '@crm/types';
import type { CreateContactInput, UpdateContactInput } from '@crm/validation';

import { apiClient } from '@/lib/api-client';

export interface ListContactsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  companyId?: string;
  status?: string;
}

export type ContactWithCompany = Contact & {
  company: { id: string; name: string };
  owner: { id: string; firstName: string; lastName: string } | null;
};

export function listContacts(params: ListContactsParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.status) query.set('status', params.status);

  return apiClient<OffsetPaginatedResult<ContactWithCompany>>(`/contacts?${query.toString()}`);
}

export function getContact(id: string) {
  return apiClient<Contact>(`/contacts/${id}`);
}

export function createContact(input: CreateContactInput) {
  return apiClient<Contact>('/contacts', { method: 'POST', body: input });
}

export function updateContact(id: string, input: UpdateContactInput) {
  return apiClient<Contact>(`/contacts/${id}`, { method: 'PATCH', body: input });
}

export function deleteContact(id: string) {
  return apiClient<void>(`/contacts/${id}`, { method: 'DELETE' });
}
