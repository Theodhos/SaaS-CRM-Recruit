import type { TokenPayload } from '@crm/auth';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: TokenPayload }>();
    const userRole = request.user?.role;

    const hasRole = userRole !== undefined && required.includes(userRole);
    if (!hasRole) {
      throw new ForbiddenException(`Requires one of role(s): ${required.join(', ')}`);
    }
    return true;
  }
}
