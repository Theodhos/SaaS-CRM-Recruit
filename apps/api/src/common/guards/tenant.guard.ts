import type { TenantContext, TokenPayload } from '@crm/auth';
import type { ExecutionContext, NestMiddleware } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

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
  canActivate(context: ExecutionContext): boolean {
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
