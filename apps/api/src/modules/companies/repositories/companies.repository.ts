import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateCompanyDto } from '../dto/create-company.dto';
import type { ListCompaniesQueryDto } from '../dto/list-companies-query.dto';
import type { UpdateCompanyDto } from '../dto/update-company.dto';

/**
 * Tenant-scoped data access for 'companies'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class CompaniesRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  async findMany(organisationId: string, query: ListCompaniesQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { industry: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { city: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.company.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { jobs: true, candidates: true, contacts: true } } },
      }),
      this.cache.cachedCount(organisationId, 'companies', where, () => db.company.count({ where })),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).company.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { jobs: true, candidates: true, contacts: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Existence check used by other modules (Contacts, Jobs) validating a companyId belongs to this org before writing a foreign key to it. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .company.count({ where: { id, deletedAt: null } })
      .then((count) => count > 0);
  }

  /** Case-insensitive exact name match, used to avoid creating a duplicate Company for the same employer (e.g. resolving Candidate.currentCompany). */
  findByName(organisationId: string, name: string) {
    return this.db.forTenant(organisationId).company.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
    });
  }

  create(organisationId: string, ownerId: string, dto: CreateCompanyDto) {
    return this.db.forTenant(organisationId).company.create({
      data: { ...dto, organisationId, ownerId: dto.ownerId ?? ownerId },
    });
  }

  /** Replaces what the Pipeline Companies pop-up keeps for the company (see service/pipeline-record.ts). */
  setPipelineRecord(organisationId: string, id: string, record: object) {
    return this.db.forTenant(organisationId).company.update({ where: { id }, data: { pipelineRecord: record } });
  }

  update(organisationId: string, id: string, dto: UpdateCompanyDto) {
    return this.db.forTenant(organisationId).company.update({
      where: { id },
      data: dto,
    });
  }

  /** The company, its jobs, and the cards of the people who applied to those jobs. */
  softDelete(organisationId: string, id: string) {
    const db = this.db.forTenant(organisationId);
    const deletedAt = new Date();
    return db.$transaction([
      db.application.updateMany({ where: { job: { companyId: id }, deletedAt: null }, data: { deletedAt } }),
      db.job.updateMany({ where: { companyId: id, deletedAt: null }, data: { deletedAt, closedAt: deletedAt, status: 'CLOSED' } }),
      db.company.update({ where: { id }, data: { deletedAt } }),
    ]);
  }
}
