import type { PlacementStatus } from '@crm/database';
import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreatePlacementDto } from '../dto/create-placement.dto';
import type { ListPlacementsQueryDto } from '../dto/list-placements-query.dto';
import type { UpdatePlacementDto } from '../dto/update-placement.dto';

const RELATION_INCLUDE = {
  candidate: { select: { id: true, firstName: true, lastName: true } },
  job: { select: { id: true, title: true } },
  company: { select: { id: true, name: true } },
  documents: { orderBy: { createdAt: 'desc' as const } },
};

/**
 * Tenant-scoped data access for 'placements'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class PlacementsRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  async findMany(organisationId: string, query: ListPlacementsQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = {
      // a single status ("ACTIVE") or several ("COMPLETED,CANCELLED" — Completed Contract shows both by default)
      ...(query.status ? { status: { in: query.status.split(',') as PlacementStatus[] } } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.employmentType ? { employmentType: query.employmentType } : {}),
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search
        ? {
            OR: [
              { candidate: { firstName: { contains: query.search, mode: 'insensitive' as const } } },
              { candidate: { lastName: { contains: query.search, mode: 'insensitive' as const } } },
              { company: { name: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.placement.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { startDate: 'desc' },
        include: RELATION_INCLUDE,
      }),
      this.cache.cachedCount(organisationId, 'placements', where, () => db.placement.count({ where })),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).placement.findFirst({
      where: { id },
      include: RELATION_INCLUDE,
    });
  }

  /** Existence check with the same tenant filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .placement.count({ where: { id } })
      .then((count) => count > 0);
  }

  /** Dedupe guard for auto-placement (see ApplicationsService) — a pipeline stage can be re-entered (moved out and back into "Placed"), and this must not spawn a second Placement each time. */
  findByCandidateAndJob(organisationId: string, candidateId: string, jobId: string) {
    return this.db.forTenant(organisationId).placement.findFirst({
      where: { candidateId, jobId },
    });
  }

  create(organisationId: string, ownerId: string, dto: CreatePlacementDto) {
    return this.db.forTenant(organisationId).placement.create({
      data: {
        ...dto,
        organisationId,
        ownerId: dto.ownerId ?? ownerId,
        // class-validator's @IsDateString() accepts a date-only string
        // ("2026-10-01"), but Prisma's DateTime scalar requires a full
        // ISO-8601 datetime — convert at the one place that talks to Prisma.
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: RELATION_INCLUDE,
    });
  }

  update(organisationId: string, id: string, dto: UpdatePlacementDto) {
    return this.db.forTenant(organisationId).placement.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate === null ? null : dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: RELATION_INCLUDE,
    });
  }

  remove(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).placement.delete({ where: { id } });
  }
}
