import { PrismaClient } from './generated/client';

// Prevent exhausting the Postgres connection pool from hot-reloading in dev
// (each reload would otherwise instantiate a new PrismaClient).
declare global {
  // eslint-disable-next-line no-var
  var __crmPrismaClient: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const levels = process.env.NODE_ENV === 'development' ? (['warn', 'error'] as const) : (['error'] as const);

  // Per-statement events (duration + SQL text) feed the query-latency metrics and the slow-query log. They are
  // opt-in because emitting one event per statement is not free; the default log configuration is unchanged.
  const wantsQueryEvents = process.env.DB_QUERY_METRICS === 'true' || Boolean(process.env.DB_SLOW_QUERY_MS);

  return new PrismaClient({
    log: wantsQueryEvents
      ? [{ emit: 'event', level: 'query' }, ...levels.map((level) => ({ emit: 'stdout' as const, level }))]
      : [...levels],
  });
}

export const prisma: PrismaClient = globalThis.__crmPrismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__crmPrismaClient = prisma;
}
