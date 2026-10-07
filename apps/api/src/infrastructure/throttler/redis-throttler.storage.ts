import { Logger } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorageService } from '@nestjs/throttler';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';

/** The record shape `increment` must return (the package does not re-export the interface by name). */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * Sliding-window rate-limit counter shared by every API replica.
 *
 * Why: the default `ThrottlerStorageService` lives in one process's memory, so with N replicas each client
 * effectively gets N x the configured limit, and a restart resets everyone's counters. Here the window state
 * is in Redis, so the limit is enforced globally.
 *
 * Semantics deliberately mirror the in-memory storage (a hit counts for `ttl` ms after it happened; going over
 * `limit` blocks the key for `blockDuration` ms; blocked requests are not counted; when a block expires the key
 * starts fresh), so switching storage does not change what a client experiences.
 *
 * Atomic (one Lua script), and it reads the clock from Redis (`TIME`) so replicas with skewed clocks agree.
 * If Redis errors, the request falls back to a per-process in-memory counter — rate limiting degrades to
 * "per instance" instead of failing requests (fail-open).
 */
const SLIDING_WINDOW = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local ttl, limit, block = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])

local blockedUntil = tonumber(redis.call('GET', KEYS[2]) or '0')
if blockedUntil > now then
  return { redis.call('ZCARD', KEYS[1]), 0, 1, blockedUntil - now }
end
if blockedUntil > 0 then
  redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])
end

redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - ttl)
local seq = redis.call('INCR', KEYS[3])
redis.call('ZADD', KEYS[1], now, now .. '-' .. seq)
redis.call('PEXPIRE', KEYS[1], ttl)
redis.call('PEXPIRE', KEYS[3], ttl)

local hits = redis.call('ZCARD', KEYS[1])
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local timeToExpire = tonumber(oldest[2]) + ttl - now
if hits > limit then
  -- The block marker must outlive the block itself (by one window): the first request AFTER a block ends has to
  -- see it, in order to reset the counter like the in-memory storage does. After that the old hits have expired too.
  redis.call('SET', KEYS[2], now + block, 'PX', block + ttl)
  return { hits, timeToExpire, 1, block }
end
return { hits, timeToExpire, 0, 0 }
`;

export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly fallback = new ThrottlerStorageService();
  private lastWarn = 0;

  constructor(private readonly redis: Redis | null) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.redis) return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);

    // One hash tag per key => the three keys share a slot, so this also works on Redis Cluster.
    const base = `rl:{${throttlerName}:${key}}`;
    try {
      const [hits, timeToExpireMs, blocked, blockMs] = (await this.redis.eval(
        SLIDING_WINDOW,
        3,
        `${base}:hits`,
        `${base}:blk`,
        `${base}:seq`,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];

      return {
        totalHits: hits,
        // The throttler reports seconds (that is what it puts in Retry-After / X-RateLimit-Reset).
        timeToExpire: Math.ceil(Math.max(timeToExpireMs, 0) / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(Math.max(blockMs, 0) / 1000),
      };
    } catch (error) {
      const now = Date.now();
      if (now - this.lastWarn > 30_000) {
        this.lastWarn = now;
        this.logger.warn(`Redis rate-limit store unavailable; counting per instance for now: ${(error as Error).message}`);
      }
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  onApplicationShutdown(): void {
    this.fallback.onApplicationShutdown();
  }
}
