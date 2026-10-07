import { ACCESS_TOKEN_COOKIE } from '@crm/auth';
import { resolveBooleanConfig } from '@crm/config';
import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { parseDurationMs } from './duration';

export const REFRESH_TOKEN_COOKIE = 'crm_refresh';
/** Names the pending login challenge (password confirmed, code not yet). It is not a session: no guard reads it. */
export const LOGIN_CHALLENGE_COOKIE = 'crm_login_challenge';
const LOGIN_CHALLENGE_MAX_AGE_MS = 15 * 60_000;

interface CookieAuthTokens {
  accessToken: string;
  refreshToken: string;
}

function baseCookieOptions(config: ConfigService) {
  return {
    httpOnly: true,
    secure: resolveBooleanConfig(config.get('COOKIE_SECURE'), false),
    sameSite: 'lax' as const,
    domain: config.get<string>('COOKIE_DOMAIN', 'localhost'),
    path: '/',
  };
}

/**
 * Sets the httpOnly session cookies that both apps/web's Next.js middleware
 * (presence check on `crm_session`) and apps/api's JwtStrategy (cookie
 * fallback extractor) rely on. See docs/architecture/authentication.md.
 */
export function setAuthCookies(
  response: Response,
  tokens: CookieAuthTokens,
  config: ConfigService,
): void {
  const options = baseCookieOptions(config);
  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...options,
    maxAge: parseDurationMs(config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m')),
  });
  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...options,
    maxAge: parseDurationMs(config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d')),
  });
}

export function setChallengeCookie(response: Response, token: string, config: ConfigService): void {
  response.cookie(LOGIN_CHALLENGE_COOKIE, token, { ...baseCookieOptions(config), maxAge: LOGIN_CHALLENGE_MAX_AGE_MS });
}

export function clearChallengeCookie(response: Response, config: ConfigService): void {
  response.clearCookie(LOGIN_CHALLENGE_COOKIE, baseCookieOptions(config));
}

export function clearAuthCookies(response: Response, config: ConfigService): void {
  const options = baseCookieOptions(config);
  response.clearCookie(ACCESS_TOKEN_COOKIE, options);
  response.clearCookie(REFRESH_TOKEN_COOKIE, options);
}
