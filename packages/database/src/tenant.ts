import type { PrismaClient, Prisma } from './generated/client';

/**
 * Central tenant-isolation boundary for the database layer.
 *
 * The API layer must NEVER query `prisma` (the raw client) directly for
 * tenant-scoped models — it must go through `scopedPrisma(organisationId)`,
 * which returns a Prisma Client Extension that transparently injects
 * `organisationId` into every read/write for the models listed below.
 *
 * This is a defense-in-depth layer, not the only one: NestJS's TenantGuard
 * (apps/api/src/common/guards) must also verify the caller's JWT/session
 * organisationId before a request reaches a service. See
 * docs/architecture/multi-tenancy.md.
 */

// Prisma model property names (as they appear on PrismaClient) that carry a
// direct `organisationId` column and therefore require tenant scoping.
export const TENANT_SCOPED_MODELS = [
  'user',
  'role',
  'team',
  'company',
  'contact',
  'candidate',
  'candidateDocument',
  'tag',
  'job',
  'pipeline',
  'application',
  'applicationStageNote',
  'activity',
  'task',
  'calendarEvent',
  'interview',
  'emailThread',
  'document',
  'comment',
  'talentPool',
  'distributionList',
  'placement',
  'fee',
  'retainer',
  'renewal',
  'notification',
  'report',
  'userEngagementEvent',
  'auditLog',
  'integration',
  'phone',
  'phoneCall',
  'phoneImport',
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

/**
 * Returns a Prisma Client extended so every operation against a
 * tenant-scoped model is automatically constrained to `organisationId`.
 *
 * Usage (inside a request-scoped service, never at module scope):
 *   const db = scopedPrisma(prisma, tenantContext.organisationId);
 *   await db.candidate.findMany(); // WHERE organisationId = ... enforced
 */
export function scopedPrisma(client: PrismaClient, organisationId: string) {
  if (!organisationId) {
    throw new Error('scopedPrisma() requires a non-empty organisationId');
  }

  return client.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const modelKey = (model.charAt(0).toLowerCase() + model.slice(1)) as TenantScopedModel;

          if (!model || !TENANT_SCOPED_MODELS.includes(modelKey)) {
            return query(args);
          }

          const a = args as Record<string, unknown>;

          switch (operation) {
            case 'findUnique':
            case 'findUniqueOrThrow':
              // Falls back to findFirst semantics so the organisationId
              // constraint can be applied without breaking the unique lookup.
              a.where = { ...(a.where as Record<string, unknown>), organisationId };
              break;
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'findMany':
            case 'count':
            case 'aggregate':
            case 'groupBy':
            case 'updateMany':
            case 'deleteMany':
              a.where = { ...(a.where as Record<string, unknown>), organisationId };
              break;
            case 'update':
            case 'delete':
              a.where = { ...(a.where as Record<string, unknown>), organisationId };
              break;
            case 'create':
              a.data = { ...(a.data as Record<string, unknown>), organisationId };
              break;
            case 'createMany':
              if (Array.isArray(a.data)) {
                a.data = (a.data as Record<string, unknown>[]).map((d) => ({
                  ...d,
                  organisationId,
                }));
              }
              break;
            case 'upsert':
              a.where = { ...(a.where as Record<string, unknown>), organisationId };
              a.create = { ...(a.create as Record<string, unknown>), organisationId };
              break;
            default:
              break;
          }

          return query(a as never);
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof scopedPrisma>;
export type { Prisma };
