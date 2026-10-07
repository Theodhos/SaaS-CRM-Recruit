import { Public } from '@crm/auth';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsNumber, Max, Min } from 'class-validator';

import { MetricsService } from '../../infrastructure/metrics/metrics.service';

export const WEB_VITAL_NAMES = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'] as const;
export const WEB_VITAL_RATINGS = ['good', 'needs-improvement', 'poor'] as const;

export class WebVitalDto {
  @IsIn(WEB_VITAL_NAMES)
  name!: (typeof WEB_VITAL_NAMES)[number];

  /** Milliseconds for LCP/INP/TTFB/FCP; a unitless score for CLS. Bounded so one bad client cannot skew a histogram. */
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(600_000)
  value!: number;

  @IsIn(WEB_VITAL_RATINGS)
  rating!: (typeof WEB_VITAL_RATINGS)[number];
}

/**
 * Real-user Core Web Vitals, reported by the web app's `WebVitalsReporter` (sampled in the browser). Public — it is
 * called before/without a session and carries no personal data — so it is strictly bounded instead: a fixed set of
 * metric names and ratings (bounded label cardinality), a numeric range, a tight per-client rate limit, and no
 * user/tenant/URL information is accepted at all.
 */
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  // Five metrics per sampled page view; 240/min leaves room for fast navigation without letting one client flood the histogram.
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @Post('web-vitals')
  @HttpCode(204)
  report(@Body() dto: WebVitalDto): void {
    // CLS is a small unitless score (0.1 = "good"); scale it so it fits the millisecond-oriented buckets. The dashboard
    // divides it back by 1000.
    const value = dto.name === 'CLS' ? dto.value * 1000 : dto.value;
    this.metrics.webVitals.observe({ name: dto.name, rating: dto.rating }, value);
  }
}
