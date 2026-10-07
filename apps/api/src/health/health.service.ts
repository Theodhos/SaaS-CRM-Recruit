import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BeforeApplicationShutdown } from '@nestjs/common';
import type Redis from 'ioredis';

import { CACHE_REDIS } from '../infrastructure/cache/cache-redis.provider';
import { DatabaseService } from '../infrastructure/database/database.service';

type CheckState = 'up' | 'down' | 'skipped' | 'draining';
export interface ReadyResult {
  ok: boolean;
  checks: Record<string, CheckState>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Readiness = "should the load balancer send this instance traffic right now?", as opposed to liveness
 * ("is the process up?", `/health`). An instance that cannot reach its database is alive but must be taken
 * out of rotation; an instance that has been told to shut down must stop receiving new requests BEFORE it
 * stops serving them.
 *
 * Redis is checked only when HEALTH_REQUIRE_REDIS=true: the cache is fail-open, so an optional Redis outage
 * degrades performance but does not make an instance unfit to serve.
 */
@Injectable()
export class HealthService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(HealthService.name);
  private draining = false;
  private last: { at: number; result: ReadyResult } | undefined;
  private pending: Promise<ReadyResult> | undefined;

  constructor(
    private readonly db: DatabaseService,
    @Inject(CACHE_REDIS) private readonly redis: Redis | null,
  ) {}

  async ready(): Promise<ReadyResult> {
    if (this.draining) return { ok: false, checks: { shutdown: 'draining' } };

    // Probes come every few seconds from several load balancers — do not turn them into a query storm: reuse
    // a result younger than 1 s, and let probes that arrive while a check is running share that one check.
    if (this.last && Date.now() - this.last.at < 1000) return this.last.result;
    this.pending ??= this.check().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private async check(): Promise<ReadyResult> {
    const checks: Record<string, CheckState> = {};

    try {
      await withTimeout(this.db.client.$queryRaw`SELECT 1`, 2000);
      checks.database = 'up';
    } catch (error) {
      checks.database = 'down';
      this.logger.warn(`readiness: database check failed: ${(error as Error).message}`);
    }

    if (process.env.HEALTH_REQUIRE_REDIS === 'true') {
      try {
        if (!this.redis) throw new Error('no Redis client configured');
        await withTimeout(this.redis.ping(), 1000);
        checks.redis = 'up';
      } catch (error) {
        checks.redis = 'down';
        this.logger.warn(`readiness: redis check failed: ${(error as Error).message}`);
      }
    } else {
      checks.redis = 'skipped';
    }

    const result = { ok: Object.values(checks).every((state) => state === 'up' || state === 'skipped'), checks };
    this.last = { at: Date.now(), result };
    return result;
  }

  /**
   * Runs on SIGTERM BEFORE Nest closes the HTTP server: flip readiness to "draining", then wait
   * SHUTDOWN_DRAIN_MS so the load balancer's next probe(s) take this instance out of rotation and in-flight
   * requests finish. Default 0 = no wait (unchanged behaviour); set ~5000 behind a load balancer.
   */
  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.draining = true;
    const ms = Number(process.env.SHUTDOWN_DRAIN_MS ?? 0);
    if (ms > 0) {
      this.logger.log(`Received ${signal ?? 'shutdown'}: draining for ${ms}ms before closing the server`);
      await sleep(ms);
    }
  }
}
