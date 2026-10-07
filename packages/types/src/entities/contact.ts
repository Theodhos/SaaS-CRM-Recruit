import type { ContactStatus } from '../common';

import type { SoftDeletableEntity, TenantScopedEntity } from './base';

export interface Contact extends TenantScopedEntity, SoftDeletableEntity {
  companyId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  status: ContactStatus;
  ownerId: string | null;
}
