import type { PrismaClient } from './generated/client';

/**
 * Per-user record visibility, layered ON TOP of tenant scoping (scopedPrisma).
 *
 * An organisation's admin sees every record of the organisation. Every other user works in their own book of business:
 * the candidates, companies and jobs they own, and what hangs off them. This extension enforces that at the data-access
 * layer — every list, detail, count, dashboard aggregate, search and update goes through it — instead of trusting each
 * call site to remember a filter.
 *
 * The filter for each model, for user `u`:
 *   candidate / company / job    ownerId = u
 *   contact                      its company is owned by u
 *   application / placement      its candidate is owned by u
 *   calendarEvent                it is u's event
 *   document                     u uploaded it, or it belongs to u's candidate / company / job
 *   applicationStageNote         its application's candidate is owned by u
 *   interview                    its application's candidate is owned by u
 *   phone / phoneImport          u imported it (phones are each instructor's own calling list)
 *   phoneCall                    its phone is owned by u
 *
 * Records created by a scoped user are always owned by that user (a request cannot assign them to someone else).
 */
export const OWNER_SCOPED_MODELS = [
  'candidate',
  'company',
  'job',
  'contact',
  'application',
  'placement',
  'calendarEvent',
  'document',
  'applicationStageNote',
  'interview',
  'phone',
  'phoneCall',
  'phoneImport',
] as const;

export type OwnerScopedModel = (typeof OWNER_SCOPED_MODELS)[number];

/** Models whose `ownerId` is forced to the acting user on create. */
const OWNED_ON_CREATE: ReadonlySet<string> = new Set(['candidate', 'company', 'job', 'contact', 'application', 'placement', 'phone']);

export function ownerFilter(model: OwnerScopedModel, userId: string): Record<string, unknown> {
  switch (model) {
    case 'candidate':
    case 'company':
    case 'job':
      return { ownerId: userId };
    case 'contact':
      return { company: { ownerId: userId } };
    case 'application':
    case 'placement':
      return { candidate: { ownerId: userId } };
    case 'applicationStageNote':
    case 'interview':
      return { application: { candidate: { ownerId: userId } } };
    case 'calendarEvent':
    case 'phoneImport':
      return { userId };
    case 'phone':
      return { ownerId: userId };
    case 'phoneCall':
      return { phone: { ownerId: userId } };
    case 'document':
      return {
        OR: [
          { uploadedById: userId },
          { candidate: { ownerId: userId } },
          { company: { ownerId: userId } },
          { job: { ownerId: userId } },
        ],
      };
  }
}

/** ANDs `filter` into a where clause without disturbing its own keys (unique lookups keep their unique field on top). */
function andWhere(where: unknown, filter: Record<string, unknown>): Record<string, unknown> {
  const w = (where ?? {}) as Record<string, unknown>;
  const existing = w.AND === undefined ? [] : Array.isArray(w.AND) ? w.AND : [w.AND];
  return { ...w, AND: [...existing, filter] };
}

/**
 * Pure transformation of one Prisma operation's args — exported so it can be unit-tested without a database.
 * Returns the args unchanged for models that are not owner-scoped.
 */
export function applyOwnerScope(model: string | undefined, operation: string, args: unknown, userId: string): unknown {
  if (!model) return args;
  const key = (model.charAt(0).toLowerCase() + model.slice(1)) as OwnerScopedModel;
  if (!OWNER_SCOPED_MODELS.includes(key)) return args;

  const a = { ...((args ?? {}) as Record<string, unknown>) };
  const filter = ownerFilter(key, userId);

  switch (operation) {
    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'findMany':
    case 'count':
    case 'aggregate':
    case 'groupBy':
    case 'update':
    case 'updateMany':
    case 'delete':
    case 'deleteMany':
      a.where = andWhere(a.where, filter);
      break;
    case 'create':
      if (OWNED_ON_CREATE.has(key)) a.data = { ...(a.data as Record<string, unknown>), ownerId: userId };
      break;
    case 'createMany':
      if (OWNED_ON_CREATE.has(key) && Array.isArray(a.data)) {
        a.data = (a.data as Record<string, unknown>[]).map((d) => ({ ...d, ownerId: userId }));
      }
      break;
    case 'upsert':
      a.where = andWhere(a.where, filter);
      if (OWNED_ON_CREATE.has(key)) a.create = { ...(a.create as Record<string, unknown>), ownerId: userId };
      break;
    default:
      break;
  }
  return a;
}

/** Wraps an (already tenant-scoped) client so that every query only sees `userId`'s records. */
export function ownerScopedPrisma<T>(client: T, userId: string): T {
  if (!userId) throw new Error('ownerScopedPrisma() requires a non-empty userId');
  return (client as unknown as PrismaClient).$extends({
    name: 'owner-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(applyOwnerScope(model, operation, args, userId) as never);
        },
      },
    },
  }) as unknown as T;
}
