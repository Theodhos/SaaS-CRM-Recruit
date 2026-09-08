import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { TokenPayload } from '../types';

/**
 * Enforces fine-grained permission checks (e.g. "candidate:create") declared
 * via @Permissions() on a controller/handler. Runs after JwtAuthGuard, so
 * `request.user` is guaranteed to be a validated TokenPayload.
 *
 * Permission keys are a flat, extensible catalog (packages/database
 * Permission model) — adding a new permission never requires touching this
 * guard, only seeding the new key and attaching it to the relevant roles.
 */
@Injectable()
export class PermissionsGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: TokenPayload }>();
    const userPermissions = request.user?.permissions ?? [];

    const hasAll = required.every((permission) => userPermissions.includes(permission));
    if (!hasAll) {
      throw new ForbiddenException(
        `Missing required permission(s): ${required.filter((p) => !userPermissions.includes(p)).join(', ')}`,
      );
    }
    return true;
  }
}
