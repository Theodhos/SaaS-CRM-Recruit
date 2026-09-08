import { prisma, scopedPrisma } from '@crm/database';
import type { PrismaClient } from '@crm/database';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';

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

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  forTenant(organisationId: string) {
    return scopedPrisma(this.client, organisationId);
  }
}
