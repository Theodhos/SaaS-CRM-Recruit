import type { CalendarEvent, OffsetPaginatedResult } from '@crm/types';
import type { CreateCalendarEventInput, UpdateCalendarEventInput } from '@crm/validation';

import { apiClient } from '@/lib/api-client';

export interface ListCalendarEventsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  from?: string;
  to?: string;
  candidateId?: string;
  contactId?: string;
  companyId?: string;
  jobId?: string;
  applicationId?: string;
}

export type CalendarEventWithRelations = CalendarEvent & {
  user: { id: string; firstName: string; lastName: string };
  candidate: { id: string; firstName: string; lastName: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  company: { id: string; name: string } | null;
  job: { id: string; title: string } | null;
  application: { id: string } | null;
};

export function listCalendarEvents(params: ListCalendarEventsParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.type) query.set('type', params.type);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.candidateId) query.set('candidateId', params.candidateId);
  if (params.contactId) query.set('contactId', params.contactId);
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.jobId) query.set('jobId', params.jobId);
  if (params.applicationId) query.set('applicationId', params.applicationId);

  return apiClient<OffsetPaginatedResult<CalendarEventWithRelations>>(`/calendar?${query.toString()}`);
}

export function getCalendarEvent(id: string) {
  return apiClient<CalendarEventWithRelations>(`/calendar/${id}`);
}

export function createCalendarEvent(input: CreateCalendarEventInput) {
  return apiClient<CalendarEventWithRelations>('/calendar', { method: 'POST', body: input });
}

export function updateCalendarEvent(id: string, input: UpdateCalendarEventInput) {
  return apiClient<CalendarEventWithRelations>(`/calendar/${id}`, { method: 'PATCH', body: input });
}

export function deleteCalendarEvent(id: string) {
  return apiClient<void>(`/calendar/${id}`, { method: 'DELETE' });
}
