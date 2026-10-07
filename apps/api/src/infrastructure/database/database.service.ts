import { ownerScopedPrisma, prisma, scopedPrisma } from '@crm/database';
import type { PrismaClient } from '@crm/database';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable, Logger, Optional } from '@nestjs/common';

import { getRecordOwnerScope } from '../../common/context/request-context';
import { MetricsService } from '../metrics/metrics.service';

/** The slice of Prisma's `$on('query')` we use (the shared client is typed without log-event generics). */
interface QueryEventSource {
  $on(event: 'query', callback: (e: { query: string; duration: number | bigint }) => void): void;
}

/**
 * Thin lifecycle wrapper around the shared @crm/database PrismaClient
 * singleton, plus the entry point for obtaining a tenant-scoped client.
 * Domain repositories should depend on `forTenant(organisationId)`, not on
 * the raw client, for anything that touches a tenant-scoped model — see
 * packages/database/src/tenant.ts.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly client: PrismaClient = prisma;

  constructor(@Optional() private readonly metrics?: MetricsService) {}

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('Database connection established');
    this.observeQueries();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  /**
   * Tenant-scoped client. When the current request belongs to a non-admin user, it is additionally limited to that
   * user's own records (see packages/database/src/owner-scope.ts); admins and non-request work see the whole tenant.
   */
  forTenant(organisationId: string) {
    const tenant = scopedPrisma(this.client, organisationId);
    const ownerId = getRecordOwnerScope();
    return ownerId ? ownerScopedPrisma(tenant, ownerId) : tenant;
  }

  /**
   * Query-latency metrics (DB_QUERY_METRICS=true) and the slow-query log (DB_SLOW_QUERY_MS=<ms>). The client only
   * emits statement events when one of those is set (see packages/database/src/client.ts), so with neither this
   * registers nothing. The logged text is the parameterised SQL (`$1, $2`) — never bound values, which can hold
   * personal data.
   */
  private observeQueries(): void {
    const slowMs = Number(process.env.DB_SLOW_QUERY_MS ?? 0);
    if (process.env.DB_QUERY_METRICS !== 'true' && !slowMs) return;

    (this.client as unknown as QueryEventSource).$on('query', (event) => {
      const ms = Number(event.duration);
      this.metrics?.observeQuery(ms);
      if (slowMs && ms >= slowMs) {
        this.logger.warn(`slow query ${ms}ms: ${event.query.replace(/\s+/g, ' ').slice(0, 300)}`);
      }
    });
  }
}
