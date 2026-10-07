import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TenantGuard } from './tenant.guard';

/**
 * TenantGuard is the central enforcement point for spec §36's multi-tenancy
 * guarantee ("no user from Organisation A can ever see Organisation B's
 * data"). It can't stop a caller from lying about their own
 * organisationId — that's not possible, since organisationId comes from
 * their own signed JWT — but it MUST refuse to proceed when a request has
 * no resolved organisationId at all, and it must publish exactly the
 * tenant context every downstream service relies on via @CurrentTenant().
 */
describe('TenantGuard', () => {
  const guard = new TenantGuard(new Reflector());

  function makeContext(request: Record<string, unknown>, isPublic = false): ExecutionContext {
    const reflector = (guard as unknown as { reflector: Reflector }).reflector;
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}) as never,
      getClass: () => ({}) as never,
    } as unknown as ExecutionContext;
  }

  afterEach(() => jest.restoreAllMocks());

  it('allows @Public() routes through without a resolved tenant', () => {
    const request: Record<string, unknown> = {};
    const context = makeContext(request, true);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.tenant).toBeUndefined();
  });

  it('denies a request whose token carries no organisationId', () => {
    const request = { user: { sub: 'user_1', email: 'a@b.com' } };
    const context = makeContext(request);

    expect(guard.canActivate(context)).toBe(false);
    expect(request).not.toHaveProperty('tenant');
  });

  it('denies a request with no user at all', () => {
    const context = makeContext({});
    expect(guard.canActivate(context)).toBe(false);
  });

  it('publishes a TenantContext built only from the validated token, never from the request body/query', () => {
    const request: Record<string, unknown> = {
      user: {
        sub: 'user_1',
        organisationId: 'org_a',
        email: 'a@b.com',
        role: 'Recruiter',
        permissions: ['candidate:read'],
      },
      // Simulates an attacker trying to smuggle a different org via a query
      // param — TenantGuard must never read this.
      query: { organisationId: 'org_b' },
    };
    const context = makeContext(request);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.tenant).toEqual({
      userId: 'user_1',
      organisationId: 'org_a',
      email: 'a@b.com',
      role: 'Recruiter',
      permissions: ['candidate:read'],
    });
  });
});
