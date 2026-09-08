export { prisma } from './client';
export { scopedPrisma, TENANT_SCOPED_MODELS } from './tenant';
export type { TenantScopedModel, ScopedPrismaClient } from './tenant';

export * from './generated/client';
