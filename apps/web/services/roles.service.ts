import type { Role } from '@crm/types';

import { apiClient } from '@/lib/api-client';

export type RoleWithCount = Role & { _count: { users: number } };

export function listRoles() {
  return apiClient<RoleWithCount[]>('/roles');
}
