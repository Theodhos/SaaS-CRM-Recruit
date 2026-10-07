import type { AuthenticatedUser } from '@crm/types';

/**
 * Prisma's User-with-role-with-rolePermissions-with-permission shape, as
 * returned by AuthRepository's `userInclude`. Kept local (not exported)
 * since it's only ever the input to `toAuthenticatedUser` below.
 */
interface UserWithRole {
  id: string;
  organisationId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: string;
  allowedSections: string[];
  createdAt: Date;
  updatedAt: Date;
  role: {
    id: string;
    name: string;
    rolePermissions: { permission: { key: string } }[];
  };
}

/** Maps a Prisma User (+ role + flattened permissions) to the frontend-safe AuthenticatedUser shape — never includes passwordHash. */
export function toAuthenticatedUser(user: UserWithRole): AuthenticatedUser {
  return {
    id: user.id,
    organisationId: user.organisationId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    status: user.status as AuthenticatedUser['status'],
    role: { id: user.role.id, name: user.role.name },
    permissions: user.role.rolePermissions.map((rp) => rp.permission.key),
    allowedSections: user.allowedSections,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function flattenPermissions(user: UserWithRole): string[] {
  return user.role.rolePermissions.map((rp) => rp.permission.key);
}
