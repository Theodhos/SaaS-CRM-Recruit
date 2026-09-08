import { Global, Module } from '@nestjs/common';

import { PRISMA_CLIENT } from './database.constants';
import { DatabaseService } from './database.service';

/**
 * Global module exposing the base PrismaClient. Domain modules should NOT
 * inject this directly for tenant-scoped reads/writes — instead use
 * scopedPrisma() (packages/database) inside each module's repository,
 * seeded with the resolved TenantContext. This module exists so there is
 * exactly one PrismaClient instance/connection pool for the whole process.
 */
@Global()
@Module({
  providers: [DatabaseService, { provide: PRISMA_CLIENT, useExisting: DatabaseService }],
  exports: [DatabaseService, PRISMA_CLIENT],
})
export class DatabaseModule {}
