import { Injectable } from '@nestjs/common';

import type { DatabaseService } from '../../../infrastructure/database/database.service';

/**
 * Tenant-scoped data access for 'reports'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class ReportsRepository {
  constructor(private readonly db: DatabaseService) {}
}
