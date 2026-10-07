import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { TokenPayload } from '../types';

/** Name of the httpOnly cookie the access token is stored in — see the auth module's cookie helper. */
export const ACCESS_TOKEN_COOKIE = 'crm_session';

function fromAuthCookie(request: Request): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  const match = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(ACCESS_TOKEN_COOKIE.length + 1)) : null;
}

/**
 * Validates the JWT signature/expiry and hands the decoded payload to
 * Passport, which NestJS attaches to `request.user`. This strategy does
 * NOT hit the database — it trusts the signed token. Anything requiring a
 * fresh DB lookup (e.g. "is this user still active?") belongs in a guard
 * or interceptor downstream, not here.
 *
 * Accepts the token from either an `Authorization: Bearer` header (API
 * clients/tools) or the `crm_session` httpOnly cookie (apps/web, via
 * `fetch(..., { credentials: 'include' })`) — no client-side JS ever needs
 * to read the token itself.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(secret: string) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        fromAuthCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: TokenPayload): TokenPayload {
    return payload;
  }
}
