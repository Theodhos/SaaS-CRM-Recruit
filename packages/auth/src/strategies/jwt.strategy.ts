import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { TokenPayload } from '../types';

/**
 * Validates the JWT signature/expiry and hands the decoded payload to
 * Passport, which NestJS attaches to `request.user`. This strategy does
 * NOT hit the database — it trusts the signed token. Anything requiring a
 * fresh DB lookup (e.g. "is this user still active?") belongs in a guard
 * or interceptor downstream, not here.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(secret: string) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: TokenPayload): TokenPayload {
    return payload;
  }
}
