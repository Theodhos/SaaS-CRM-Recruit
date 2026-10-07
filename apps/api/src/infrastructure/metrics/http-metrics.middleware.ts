import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { MetricsService } from './metrics.service';

/** Paths that are probes or the scrape itself — excluded so they do not drown out (or skew) real traffic. */
const IGNORED = /^\/(health|metrics)(\/|$)/;

/**
 * Express middleware (not a Nest interceptor) on purpose: it must also observe requests that are rejected
 * by a guard (401/403/429) or match no route (404), which never reach an interceptor.
 */
export function httpMetricsMiddleware(metrics: MetricsService): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (IGNORED.test(req.path)) return next();

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      // `req.route.path` is the matched pattern (`/api/v1/candidates/:id`); no match => one shared label.
      const route = (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      metrics.observeHttp(req.method, route, res.statusCode, seconds);
    });
    next();
  };
}
