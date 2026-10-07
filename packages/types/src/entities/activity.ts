import type { ActivityType } from '../common';

export interface Activity {
  id: string;
  organisationId: string;
  type: ActivityType;
  subject: string | null;
  description: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  userId: string;
  candidateId: string | null;
  companyId: string | null;
  contactId: string | null;
  jobId: string | null;
  applicationId: string | null;
  createdAt: string;
}
