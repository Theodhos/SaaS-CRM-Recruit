import { timingSafeEqual } from 'node:crypto';

import { Public } from '@crm/auth';
import { Controller, Get, Header, Headers, NotFoundException, StreamableFile, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { MetricsService } from './metrics.service';

/**
 * Prometheus scrape endpoint, outside the versioned prefix (`/metrics`). It is NOT reachable from the
 * internet: the edge (nginx) only proxies /api/, /health, /socket.io and the web app, so Prometheus scrapes
 * replicas directly over the internal network. As a second layer it requires a bearer token.
 *
 * Disabled entirely (404) unless METRICS_TOKEN is set — an unauthenticated metrics endpoint leaks route
 * names, traffic volumes and internals.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @SkipThrottle()
  @Get()
  @Header('Cache-Control', 'no-store')
  async scrape(@Headers('authorization') authorization?: string): Promise<StreamableFile> {
    const expected = process.env.METRICS_TOKEN;
    if (!expected) throw new NotFoundException();

    const presented = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
    const a = Buffer.from(presented);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();

    // StreamableFile is passed through the response-envelope interceptor untouched (see its doc comment),
    // so Prometheus receives the plain text exposition format rather than a JSON envelope.
    return new StreamableFile(Buffer.from(await this.metrics.render()), { type: this.metrics.contentType });
  }
}
