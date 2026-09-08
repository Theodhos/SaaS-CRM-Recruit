/**
 * Compile-time-checked mirror of the seeded Permission catalog
 * (packages/database/prisma/seed/permissions.ts). Using this const object
 * with @Permissions(PERMISSIONS.CANDIDATE.CREATE) instead of a raw string
 * catches typos at build time; the runtime source of truth remains the
 * database Permission table.
 */
export const PERMISSIONS = {
  CANDIDATE: {
    CREATE: 'candidate:create',
    READ: 'candidate:read',
    UPDATE: 'candidate:update',
    DELETE: 'candidate:delete',
  },
  COMPANY: {
    CREATE: 'company:create',
    READ: 'company:read',
    UPDATE: 'company:update',
    DELETE: 'company:delete',
  },
  CONTACT: {
    CREATE: 'contact:create',
    READ: 'contact:read',
    UPDATE: 'contact:update',
    DELETE: 'contact:delete',
  },
  JOB: { CREATE: 'job:create', READ: 'job:read', UPDATE: 'job:update', DELETE: 'job:delete' },
  APPLICATION: {
    CREATE: 'application:create',
    READ: 'application:read',
    UPDATE: 'application:update',
    DELETE: 'application:delete',
  },
  PLACEMENT: {
    CREATE: 'placement:create',
    READ: 'placement:read',
    UPDATE: 'placement:update',
    DELETE: 'placement:delete',
  },
  TASK: { CREATE: 'task:create', READ: 'task:read', UPDATE: 'task:update', DELETE: 'task:delete' },
  DOCUMENT: {
    CREATE: 'document:create',
    READ: 'document:read',
    UPDATE: 'document:update',
    DELETE: 'document:delete',
  },
  REPORTS: { VIEW: 'reports:view' },
  ANALYTICS: { VIEW: 'analytics:view' },
  SETTINGS: { MANAGE: 'settings:manage' },
  USERS: { MANAGE: 'users:manage' },
} as const;
