import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

import type { TokenPayload } from '../types';

/** Injects the authenticated user's decoded token payload into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: TokenPayload }>();
    return request.user;
  },
);
