import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Coarse-grained role gate, e.g. @Roles('ADMIN'). Prefer @Permissions() (packages/auth) for most authorization checks — roles are for broad structural gates only. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
