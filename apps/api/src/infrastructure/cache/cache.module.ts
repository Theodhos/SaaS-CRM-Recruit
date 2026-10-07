import { Global, Module } from '@nestjs/common';

import { CACHE_REDIS, cacheRedisProvider } from './cache-redis.provider';
import { CacheService } from './cache.service';
import { TenantCacheInvalidationInterceptor } from './tenant-cache-invalidation.interceptor';

/**
 * Redis-backed cache-aside, rate-limit counters and scheduler locks. Everything is opt-in (see
 * `redisFeaturesEnabled`) and fail-open, so with default configuration this module opens no connection and
 * changes no behaviour.
 */
@Global()
@Module({
  providers: [cacheRedisProvider, CacheService, TenantCacheInvalidationInterceptor],
  exports: [CACHE_REDIS, CacheService, TenantCacheInvalidationInterceptor],
})
export class CacheModule {}
