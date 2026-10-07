import type { TaskPriority, TaskStatus } from '../common';

import type { TenantScopedEntity } from './base';

export interface Task extends TenantScopedEntity {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignedToId: string;
  createdById: string;
  candidateId: string | null;
  companyId: string | null;
  contactId: string | null;
  jobId: string | null;
  applicationId: string | null;
}
