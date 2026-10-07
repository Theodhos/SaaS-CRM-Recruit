export { prisma } from './client';
export { scopedPrisma, TENANT_SCOPED_MODELS } from './tenant';
export type { TenantScopedModel, ScopedPrismaClient } from './tenant';
export { ownerScopedPrisma, applyOwnerScope, OWNER_SCOPED_MODELS } from './owner-scope';
export type { OwnerScopedModel } from './owner-scope';

export * from './generated/client';
