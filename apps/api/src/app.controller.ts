import { Public } from '@crm/auth';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { HealthService } from './health/health.service';

/**
 * Probes — intentionally outside the versioned /api/v1 module tree, public, and exempt from rate limiting
 * (a load balancer probing every few seconds must never be throttled into marking a healthy instance down).
 *
 *   GET /health        liveness  — the process answers. (Unchanged contract.)
 *   GET /health/live   liveness  — alias.
 *   GET /health/ready  readiness — database (and Redis when required) reachable, not shutting down.
 *                                  200 when ready, 503 otherwise; used by the load balancer and deploy script.
 */
@Controller('health')
@SkipThrottle()
export class AppController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async ready() {
    const { ok, checks } = await this.health.ready();
    if (!ok) {
      const failing = Object.entries(checks)
        .filter(([, state]) => state !== 'up' && state !== 'skipped')
        .map(([name, state]) => `${name}=${state}`)
        .join(', ');
      throw new ServiceUnavailableException(`Not ready: ${failing}`);
    }
    return { status: 'ready', checks, timestamp: new Date().toISOString() };
  }
}
