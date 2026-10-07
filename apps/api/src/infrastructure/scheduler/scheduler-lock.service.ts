import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

import { CACHE_REDIS } from '../cache/cache-redis.provider';

const RELEASE = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

/**
 * Makes an in-process `@Cron()` safe to run on every API replica.
 *
 * Without it, N replicas each run every sweep, so a "task is overdue" notification would be sent N times.
 * With SCHEDULER_LOCK=redis the first replica to take a short-lived lock runs the sweep and the others skip
 * that tick. The lock is released as soon as the sweep finishes; its TTL only matters if a replica dies
 * mid-sweep (the next tick after the TTL then proceeds).
 *
 * Defaults keep today's behaviour exactly: with SCHEDULER_LOCK unset every instance runs every sweep.
 * Fail-open: if Redis is unreachable the sweep runs anyway — a duplicate reminder is better than none, and the
 * sweeps are already idempotent per row (`overdueNotifiedAt`, `reminderSentAt`).
 *
 * `SCHEDULER_ENABLED=false` turns the sweeps off on a replica altogether (for API-only instances when a
 * dedicated scheduler instance exists).
 */
@Injectable()
export class SchedulerLockService {
  private readonly logger = new Logger(SchedulerLockService.name);

  constructor(@Inject(CACHE_REDIS) private readonly redis: Redis | null) {}

  async runExclusive(name: string, ttlMs: number, job: () => Promise<void>): Promise<void> {
    if (process.env.SCHEDULER_ENABLED === 'false') return;
    if (process.env.SCHEDULER_LOCK !== 'redis' || !this.redis) return job();

    const key = `lock:scheduler:${name}`;
    const token = randomUUID();
    let acquired: boolean;
    try {
      acquired = (await this.redis.set(key, token, 'PX', ttlMs, 'NX')) === 'OK';
    } catch (error) {
      this.logger.warn(`Scheduler lock unavailable, running "${name}" without it: ${(error as Error).message}`);
      return job();
    }
    if (!acquired) {
      this.logger.debug(`"${name}" is already running on another instance; skipping this tick`);
      return;
    }

    try {
      await job();
    } finally {
      await this.redis.eval(RELEASE, 1, key, token).catch(() => undefined);
    }
  }
}
