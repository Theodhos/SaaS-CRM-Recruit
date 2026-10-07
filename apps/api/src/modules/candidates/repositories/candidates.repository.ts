import type { ApplicationStatus, Prisma } from '@crm/database';
import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateCandidateDto } from '../dto/create-candidate.dto';
import type { ListCandidatesQueryDto, ReviewStatus } from '../dto/list-candidates-query.dto';
import type { UpdateCandidateDto } from '../dto/update-candidate.dto';

/** Application statuses that mean "still in play" (or hired). Anything else is a closed door. */
const LIVE_APPLICATION = { in: ['ACTIVE', 'ON_HOLD', 'PLACED'] as ApplicationStatus[] };
/**
 * Just enough of each application to derive the review status (PENDING / ACTIVE / REJECTED) and the "where are they
 * now" pipeline stage that the Candidates table shows — the raw rows never leave the service.
 */
const APPLICATION_SUMMARY = {
  where: { deletedAt: null },
  select: {
    status: true,
    jobId: true,
    pipelineId: true,
    updatedAt: true,
    job: { select: { title: true } },
    pipelineStage: { select: { name: true, type: true, order: true } },
  },
} as const;
const REVIEW_STATUS_WHERE: Record<ReviewStatus, Prisma.CandidateWhereInput> = {
  PENDING: { applications: { none: { deletedAt: null } } },
  ACTIVE: { applications: { some: { deletedAt: null, status: LIVE_APPLICATION } } },
  REJECTED: {
    AND: [{ applications: { some: { deletedAt: null } } }, { applications: { none: { deletedAt: null, status: LIVE_APPLICATION } } }],
  },
  REAPPLIED: {
    AND: [
      { applications: { some: { deletedAt: null, status: { in: ['REJECTED', 'WITHDRAWN'] as ApplicationStatus[] } } } },
      { applications: { some: { deletedAt: null, status: LIVE_APPLICATION } } },
    ],
  },
  // the pool the suggestion matcher works on: anyone turned down at least once (the service narrows it to those
  // with a similar open job)
  SUGGESTED: { applications: { some: { deletedAt: null, status: { in: ['REJECTED', 'WITHDRAWN'] as ApplicationStatus[] } } } },
};

/**
 * Tenant-scoped data access for 'candidates'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class CandidatesRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  /** Shared list filter — `findMany` (page + total) and `findPage` (page only) must never diverge on it. */
  private listWhere(query: ListCandidatesQueryDto) {
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.interestedJobId ? { interestedJobId: query.interestedJobId } : {}),
      ...(query.unassigned ? { applications: { none: {} } } : {}),
      ...(query.hasApplications ? { applications: { some: {} } } : {}),
      ...(query.reviewStatus ? REVIEW_STATUS_WHERE[query.reviewStatus] : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search, mode: 'insensitive' as const } },
              { jobTitle: { contains: query.search, mode: 'insensitive' as const } },
              { currentCompany: { contains: query.search, mode: 'insensitive' as const } },
              { location: { contains: query.search, mode: 'insensitive' as const } },
              { source: { contains: query.search, mode: 'insensitive' as const } },
              // the "Interested in" column: the job they are after, and that job's company
              { interestedJob: { title: { contains: query.search, mode: 'insensitive' as const } } },
              { interestedJob: { company: { name: { contains: query.search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
  }

  /** One page of candidates, without the total — for callers that never read it (the unassigned pool derives its own total). */
  findPage(organisationId: string, query: ListCandidatesQueryDto) {
    return this.db.forTenant(organisationId).candidate.findMany({
      where: this.listWhere(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        interestedJob: { select: { id: true, title: true, location: true, company: { select: { id: true, name: true } } } },
        applications: APPLICATION_SUMMARY,
      },
    });
  }

  async findMany(organisationId: string, query: ListCandidatesQueryDto) {
    const [items, totalItems] = await Promise.all([
      this.findPage(organisationId, query),
      this.cache.cachedCount(organisationId, 'candidates', this.listWhere(query), () =>
        this.db.forTenant(organisationId).candidate.count({ where: this.listWhere(query) }),
      ),
    ]);

    return { items, totalItems };
  }

  /** The openings a rejected candidate could be suggested for. */
  findOpenJobs(organisationId: string) {
    return this.db.forTenant(organisationId).job.findMany({
      where: { deletedAt: null, status: 'OPEN' },
      select: { id: true, title: true, location: true, company: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).candidate.findFirst({
      where: { id, deletedAt: null },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        candidateTags: { include: { tag: true } },
        company: true,
        interestedJob: { select: { id: true, title: true, location: true, company: { select: { id: true, name: true } } } },
        // same derived status + current stage as the list, so the detail page agrees with the table
        applications: APPLICATION_SUMMARY,
      },
    });
  }

  /** Existence check with the same tenant and soft-delete filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .candidate.count({ where: { id, deletedAt: null } })
      .then((count) => count > 0);
  }

  create(organisationId: string, ownerId: string, dto: CreateCandidateDto, companyId?: string) {
    return this.db.forTenant(organisationId).candidate.create({
      data: { ...dto, organisationId, ownerId: dto.ownerId ?? ownerId, companyId },
    });
  }

  update(organisationId: string, id: string, dto: UpdateCandidateDto) {
    return this.db.forTenant(organisationId).candidate.update({
      where: { id },
      data: dto,
    });
  }

  /** The candidate, and their cards on the pipelines with them. */
  softDelete(organisationId: string, id: string) {
    const db = this.db.forTenant(organisationId);
    const deletedAt = new Date();
    return db.$transaction([
      db.application.updateMany({ where: { candidateId: id, deletedAt: null }, data: { deletedAt } }),
      db.candidate.update({ where: { id }, data: { deletedAt } }),
    ]);
  }
}
