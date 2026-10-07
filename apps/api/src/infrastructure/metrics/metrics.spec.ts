import { EventEmitter } from 'node:events';

import { NotFoundException, UnauthorizedException } from '@nestjs/common';

import { restoreEnv } from '../testing/redis-test-utils';

import { httpMetricsMiddleware } from './http-metrics.middleware';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

function fakeExchange(path: string, method: string, route: string | undefined, statusCode: number) {
  const req = { path, method, route: route ? { path: route } : undefined };
  const res = Object.assign(new EventEmitter(), { statusCode });
  return { req, res };
}

async function streamToString(file: { getStream(): NodeJS.ReadableStream }): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of file.getStream()) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
}

describe('httpMetricsMiddleware', () => {
  it('labels by the matched ROUTE PATTERN, never the raw URL (bounded cardinality)', async () => {
    const metrics = new MetricsService();
    const middleware = httpMetricsMiddleware(metrics);
    const next = jest.fn();

    for (const id of ['cabc1', 'cabc2', 'cabc3']) {
      const { req, res } = fakeExchange(`/api/v1/candidates/${id}`, 'GET', '/api/v1/candidates/:id', 200);
      middleware(req as never, res as never, next);
      res.emit('finish');
    }

    const text = await metrics.render();
    // three different ids, ONE series
    expect(text).toContain('http_requests_total{method="GET",route="/api/v1/candidates/:id",status_code="200"} 3');
    expect(text).not.toContain('cabc1');
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('records unmatched routes (404) under one shared label and guard rejections with their status', async () => {
    const metrics = new MetricsService();
    const middleware = httpMetricsMiddleware(metrics);

    const notFound = fakeExchange('/api/v1/whatever-1', 'GET', undefined, 404);
    middleware(notFound.req as never, notFound.res as never, jest.fn());
    notFound.res.emit('finish');
    const unauthorized = fakeExchange('/api/v1/candidates', 'GET', '/api/v1/candidates', 401);
    middleware(unauthorized.req as never, unauthorized.res as never, jest.fn());
    unauthorized.res.emit('finish');

    const text = await metrics.render();
    expect(text).toMatch(/http_requests_total\{[^}]*route="unmatched"[^}]*status_code="404"[^}]*\} 1/);
    expect(text).toMatch(/http_requests_total\{[^}]*route="\/api\/v1\/candidates"[^}]*status_code="401"[^}]*\} 1/);
  });

  it('ignores probes and the scrape itself', async () => {
    const metrics = new MetricsService();
    const middleware = httpMetricsMiddleware(metrics);

    for (const path of ['/health', '/health/ready', '/metrics']) {
      const { req, res } = fakeExchange(path, 'GET', path, 200);
      middleware(req as never, res as never, jest.fn());
      res.emit('finish');
    }

    expect(await metrics.render()).not.toMatch(/http_requests_total\{/);
  });
});

describe('MetricsController', () => {
  const previous = process.env.METRICS_TOKEN;
  afterEach(() => restoreEnv('METRICS_TOKEN', previous));
  const controller = () => new MetricsController(new MetricsService());

  it('is disabled (404) unless METRICS_TOKEN is configured', async () => {
    delete process.env.METRICS_TOKEN;
    await expect(controller().scrape('Bearer anything')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a missing or wrong token (401)', async () => {
    process.env.METRICS_TOKEN = 's3cret-token';
    const c = controller();
    await expect(c.scrape(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(c.scrape('Bearer wrong-token!')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(c.scrape('s3cret-token')).rejects.toBeInstanceOf(UnauthorizedException); // not a Bearer header
  });

  it('serves the Prometheus text format with the right token, including process and event-loop metrics', async () => {
    process.env.METRICS_TOKEN = 's3cret-token';
    const body = await streamToString(await controller().scrape('Bearer s3cret-token'));

    expect(body).toContain('# TYPE http_request_duration_seconds histogram');
    expect(body).toContain('nodejs_eventloop_lag_p99_seconds');
    expect(body).toContain('process_cpu_seconds_total');
  });
});

describe('MetricsService', () => {
  it('records DB statements and cache outcomes', async () => {
    const metrics = new MetricsService();
    metrics.observeQuery(12);
    metrics.observeQuery(3);
    metrics.cacheRequests.inc({ name: 'analytics:overview', result: 'hit' });

    const text = await metrics.render();
    expect(text).toMatch(/crm_db_queries_total(\{[^}]*\})? 2/);
    expect(text).toContain('crm_cache_requests_total{name="analytics:overview",result="hit"');
  });
});
