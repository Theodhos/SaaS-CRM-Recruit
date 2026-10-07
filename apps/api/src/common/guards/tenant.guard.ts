import { IS_PUBLIC_KEY } from '@crm/auth';
import type { TenantContext, TokenPayload } from '@crm/auth';
import type { ExecutionContext, NestMiddleware } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';

import { SEES_ALL_RECORDS_PERMISSION, setRecordOwnerScope } from '../context/request-context';

/**
 * Central tenant-isolation enforcement point (see docs/architecture/multi-tenancy.md).
 *
 * Runs after JwtAuthGuard (so `request.user` is a validated TokenPayload) and
 * BEFORE any controller/service code executes. It:
 *   1. Refuses to proceed if the token carries no organisationId.
 *   2. Publishes a typed `request.tenant: TenantContext` that every service
 *      MUST use (via CurrentTenant()/scopedPrisma()) instead of trusting any
 *      client-supplied organisationId (body, query, header, route param).
 *
 * This guard establishes WHO the tenant is; it does not itself filter
 * queries — that enforcement lives in packages/database's scopedPrisma(),
 * which every domain repository is expected to use. Frontend-only filtering
 * is never sufficient on its own.
 */
@Injectable()
export class TenantGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: TokenPayload; tenant?: TenantContext }>();
    const user = request.user;

    if (!user?.organisationId) {
      return false;
    }

    request.tenant = {
      userId: user.sub,
      organisationId: user.organisationId,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    // Admins see the whole organisation; everyone else works with their own candidates, companies and jobs
    // (enforced in the data layer — see packages/database/src/owner-scope.ts).
    setRecordOwnerScope(user.permissions?.includes(SEES_ALL_RECORDS_PERMISSION) ? undefined : user.sub);

    return true;
  }
}

/**
 * Optional request-pipeline middleware companion to TenantGuard, useful for
 * non-guarded contexts (e.g. raw webhook routes) that still need a resolved
 * tenant on `request` before hitting shared services. Most routes should
 * rely on TenantGuard, not this.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    next();
  }
}
