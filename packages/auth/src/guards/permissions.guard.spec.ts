import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { TokenPayload } from '../types';

import { PermissionsGuard } from './permissions.guard';

/**
 * Covers spec §55's explicit RBAC examples: a Viewer-shaped token cannot
 * hit a handler requiring `candidate:create`; a Recruiter-shaped token
 * (which the dev fixtures grant every permission except settings:manage/
 * users:manage) can; only an Admin-shaped token can reach a
 * `users:manage`-gated handler.
 */
describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  function makeContext(user: Partial<TokenPayload> | undefined, required: string[]): ExecutionContext {
    const reflector = (guard as unknown as { reflector: Reflector }).reflector;
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);

    return {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => ({}) as never,
      getClass: () => ({}) as never,
    } as unknown as ExecutionContext;
  }

  afterEach(() => jest.restoreAllMocks());

  it('allows a handler with no @Permissions() decorator through unconditionally', () => {
    const context = makeContext({ permissions: [] }, []);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies a Viewer-shaped token from creating a candidate', () => {
    const viewer: Partial<TokenPayload> = { permissions: ['candidate:read'] };
    const context = makeContext(viewer, ['candidate:create']);

    expect(() => guard.canActivate(context)).toThrow(/candidate:create/);
  });

  it('allows a Recruiter-shaped token to create a candidate', () => {
    const recruiter: Partial<TokenPayload> = {
      permissions: ['candidate:create', 'candidate:read', 'company:read'],
    };
    const context = makeContext(recruiter, ['candidate:create']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies a Recruiter-shaped token from managing users (Admin-only permission)', () => {
    const recruiter: Partial<TokenPayload> = { permissions: ['candidate:create', 'candidate:read'] };
    const context = makeContext(recruiter, ['users:manage']);

    expect(() => guard.canActivate(context)).toThrow(/users:manage/);
  });

  it('allows an Admin-shaped token to manage users', () => {
    const admin: Partial<TokenPayload> = { permissions: ['users:manage', 'settings:manage'] };
    const context = makeContext(admin, ['users:manage']);

    expect(guard.canActivate(context)).toBe(true);
  });
});
