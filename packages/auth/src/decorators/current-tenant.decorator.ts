import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

import type { TokenPayload } from '../types';

/**
 * Injects just the organisationId from the authenticated request. Prefer
 * this over reaching into @CurrentUser() when a handler only needs the
 * tenant boundary — it keeps the tenant-scoping intent explicit at call
 * sites (see packages/database/src/tenant.ts#scopedPrisma).
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ user: TokenPayload }>();
    return request.user.organisationId;
  },
);
