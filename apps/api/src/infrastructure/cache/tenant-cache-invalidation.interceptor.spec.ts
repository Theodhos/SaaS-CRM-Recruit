import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';

import type { CacheService } from './cache.service';
import { TenantCacheInvalidationInterceptor } from './tenant-cache-invalidation.interceptor';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

function fakeCache(enabled = true) {
  return { enabled, invalidateTenant: jest.fn(async () => undefined) } as unknown as CacheService & {
    invalidateTenant: jest.Mock;
  };
}

describe('TenantCacheInvalidationInterceptor', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('bumps the tenant version after a successful %s', async (method) => {
    const cache = fakeCache();
    const interceptor = new TenantCacheInvalidationInterceptor(cache);
    const handler: CallHandler = { handle: () => of({ id: 1 }) };

    const result = await lastValueFrom(interceptor.intercept(contextFor({ method, tenant: { organisationId: 'org_1' } }), handler));

    expect(result).toEqual({ id: 1 });
    expect(cache.invalidateTenant).toHaveBeenCalledWith('org_1');
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('does not invalidate on a read-only %s', async (method) => {
    const cache = fakeCache();
    const interceptor = new TenantCacheInvalidationInterceptor(cache);

    await lastValueFrom(interceptor.intercept(contextFor({ method, tenant: { organisationId: 'org_1' } }), { handle: () => of(1) }));

    expect(cache.invalidateTenant).not.toHaveBeenCalled();
  });

  it('still bumps when the write FAILS (it may have partly applied) and rethrows the original error', async () => {
    const cache = fakeCache();
    const interceptor = new TenantCacheInvalidationInterceptor(cache);
    const boom = new Error('write failed');

    await expect(
      lastValueFrom(interceptor.intercept(contextFor({ method: 'POST', tenant: { organisationId: 'org_1' } }), { handle: () => throwError(() => boom) })),
    ).rejects.toBe(boom);
    expect(cache.invalidateTenant).toHaveBeenCalledWith('org_1');
  });

  it('bumps BEFORE the response is released (read-your-writes)', async () => {
    const order: string[] = [];
    const cache = fakeCache();
    cache.invalidateTenant.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push('invalidated');
    });
    const interceptor = new TenantCacheInvalidationInterceptor(cache);

    const result = interceptor.intercept(contextFor({ method: 'POST', tenant: { organisationId: 'org_1' } }), { handle: () => of('done') });
    const value = await lastValueFrom(result);
    order.push(`released:${value}`);

    expect(order).toEqual(['invalidated', 'released:done']);
  });

  it('is a pass-through when the cache is disabled or the request has no tenant', async () => {
    const disabled = fakeCache(false);
    await lastValueFrom(
      new TenantCacheInvalidationInterceptor(disabled).intercept(contextFor({ method: 'POST', tenant: { organisationId: 'org_1' } }), { handle: () => of(1) }),
    );
    expect(disabled.invalidateTenant).not.toHaveBeenCalled();

    const anonymous = fakeCache();
    await lastValueFrom(new TenantCacheInvalidationInterceptor(anonymous).intercept(contextFor({ method: 'POST' }), { handle: () => of(1) }));
    expect(anonymous.invalidateTenant).not.toHaveBeenCalled();
  });
});
