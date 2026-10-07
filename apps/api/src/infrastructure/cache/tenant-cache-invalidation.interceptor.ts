import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { catchError, from, mergeMap, throwError, type Observable } from 'rxjs';

import { CacheService } from './cache.service';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * After ANY mutating request by a tenant — successful or not (a failed write may still have partly applied) —
 * bump that tenant's cache version so nothing cached before the write can be served after it.
 *
 * The bump is awaited before the response is released, which is what gives a client read-your-writes: the
 * next GET it sends sees the new version. Runs after TenantGuard, so `request.tenant` is already validated.
 * When the cache is disabled this interceptor is a pass-through.
 */
@Injectable()
export class TenantCacheInvalidationInterceptor implements NestInterceptor {
  constructor(private readonly cache: CacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.cache.enabled) return next.handle();

    const request = context.switchToHttp().getRequest<{ method: string; tenant?: { organisationId?: string } }>();
    const organisationId = request.tenant?.organisationId;
    if (!organisationId || READ_ONLY_METHODS.has(request.method)) return next.handle();

    const bump = () => from(this.cache.invalidateTenant(organisationId));
    return next.handle().pipe(
      mergeMap((value) => bump().pipe(mergeMap(() => [value]))),
      catchError((error: unknown) => bump().pipe(mergeMap(() => throwError(() => error)))),
    );
  }
}
