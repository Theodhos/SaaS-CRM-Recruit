export interface TenantScopedEntity {
  id: string;
  organisationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SoftDeletableEntity {
  deletedAt: string | null;
}
