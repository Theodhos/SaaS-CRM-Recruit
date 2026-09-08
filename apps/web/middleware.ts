import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'crm_session';
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Route-level auth gate: unauthenticated requests to anything outside the
 * (auth) route group are redirected to /login; authenticated requests to an
 * auth page are redirected to /dashboard. This checks cookie *presence*
 * only — the API is the source of truth for token validity (see
 * docs/architecture/authentication.md). Do not add business logic here.
 *
 * DISABLED for Phase 1 (see AUTH_ENFORCED below): modules/auth has no real
 * login endpoint yet, so nothing can ever set `crm_session` — leaving this
 * enforced would make every route unreachable except the placeholder
 * /login page. Flip AUTH_ENFORCED to true once Phase 2 wires up real
 * login/logout and this cookie gets set for real.
 */
const AUTH_ENFORCED = false;

export function middleware(request: NextRequest) {
  if (!AUTH_ENFORCED) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
