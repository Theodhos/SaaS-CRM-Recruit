import type { CalendarEventStatus, CalendarEventType } from '../common';

import type { TenantScopedEntity } from './base';

export interface CalendarEvent extends TenantScopedEntity {
  title: string;
  type: CalendarEventType;
  startAt: string;
  endAt: string;
  location: string | null;
  meetingUrl: string | null;
  status: CalendarEventStatus;
  userId: string;
  candidateId: string | null;
  contactId: string | null;
  companyId: string | null;
  jobId: string | null;
  applicationId: string | null;
}
