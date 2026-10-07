import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

const HTTP_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const DB_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];
const WEB_VITAL_BUCKETS = [0.01, 0.05, 0.1, 0.2, 0.5, 1, 1.8, 2.5, 4, 6, 10].map((s) => s * 1000);

/**
 * Prometheus metrics for the API process. One registry per process; Prometheus aggregates across replicas
 * (every series carries an `instance` label from service discovery), so nothing here needs to be shared
 * between instances.
 *
 * Label cardinality is deliberately bounded: HTTP metrics use the matched ROUTE PATTERN
 * (`/api/v1/candidates/:id`), never the raw URL, and no tenant / user id is ever a label.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'http_requests_total',
    help: 'HTTP requests handled by the API.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration, from first byte received to response finished.',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: HTTP_BUCKETS,
    registers: [this.registry],
  });

  readonly dbQueries = new Counter({
    name: 'crm_db_queries_total',
    help: 'SQL statements issued by Prisma.',
    registers: [this.registry],
  });

  readonly dbQueryDuration = new Histogram({
    name: 'crm_db_query_duration_seconds',
    help: 'SQL statement duration as seen by the application (includes the network round trip).',
    buckets: DB_BUCKETS,
    registers: [this.registry],
  });

  readonly cacheRequests = new Counter({
    name: 'crm_cache_requests_total',
    help: 'Cache lookups by outcome (hit | miss | bypass | error).',
    labelNames: ['name', 'result'] as const,
    registers: [this.registry],
  });

  readonly webVitals = new Histogram({
    name: 'web_vitals_value',
    help: 'Core Web Vitals reported by real browsers (LCP/INP/TTFB/FCP in ms, CLS unitless x1000).',
    labelNames: ['name', 'rating'] as const,
    buckets: WEB_VITAL_BUCKETS,
    registers: [this.registry],
  });

  constructor() {
    // process_cpu_seconds_total, nodejs_heap_size_*, nodejs_eventloop_lag_*, gc, fds ...
    collectDefaultMetrics({ register: this.registry });
  }

  observeHttp(method: string, route: string, statusCode: number, seconds: number): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, seconds);
  }

  observeQuery(milliseconds: number): void {
    this.dbQueries.inc();
    this.dbQueryDuration.observe(milliseconds / 1000);
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
