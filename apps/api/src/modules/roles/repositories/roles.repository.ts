import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';

/**
 * Tenant-scoped data access for 'roles'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class RolesRepository {
  constructor(private readonly db: DatabaseService) {}

  findMany(organisationId: string) {
    return this.db.forTenant(organisationId).role.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).role.findFirst({ where: { id } });
  }
}
