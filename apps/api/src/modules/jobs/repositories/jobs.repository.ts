import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateJobDto } from '../dto/create-job.dto';
import type { ListJobsQueryDto } from '../dto/list-jobs-query.dto';
import type { UpdateJobDto } from '../dto/update-job.dto';

@Injectable()
export class JobsRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  async findMany(organisationId: string, query: ListJobsQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { location: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.job.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { company: { select: { id: true, name: true } } },
      }),
      this.cache.cachedCount(organisationId, 'jobs', where, () => db.job.count({ where })),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).job.findFirst({
      where: { id, deletedAt: null },
      include: {
        company: { select: { id: true, name: true, industry: true, website: true, email: true, phone: true, city: true, country: true, status: true } },
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { applications: true, placements: true, interestedCandidates: true, documents: true } },
      },
    });
  }

  /** Existence check with the same tenant and soft-delete filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .job.count({ where: { id, deletedAt: null } })
      .then((count) => count > 0);
  }

  create(organisationId: string, ownerId: string, dto: Omit<CreateJobDto, 'companyName'>) {
    return this.db.forTenant(organisationId).job.create({
      data: { ...dto, organisationId, ownerId: dto.ownerId ?? ownerId },
    });
  }

  update(organisationId: string, id: string, dto: Omit<UpdateJobDto, 'companyName'>) {
    return this.db.forTenant(organisationId).job.update({
      where: { id },
      data: dto,
    });
  }

  /** The job, and the cards of the people who applied to it with it. */
  softDelete(organisationId: string, id: string) {
    const db = this.db.forTenant(organisationId);
    const deletedAt = new Date();
    return db.$transaction([
      db.application.updateMany({ where: { jobId: id, deletedAt: null }, data: { deletedAt } }),
      db.job.update({ where: { id }, data: { deletedAt, closedAt: deletedAt, status: 'CLOSED' } }),
    ]);
  }
}
