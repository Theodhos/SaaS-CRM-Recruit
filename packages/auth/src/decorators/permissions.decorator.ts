import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declares the permission key(s) a handler requires, e.g.:
 *   @Permissions('candidate:create')
 *   @Post()
 *   create() {}
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
