import type { TenantScopedEntity } from './base';

export interface Role extends TenantScopedEntity {
  name: string;
  description: string | null;
}
