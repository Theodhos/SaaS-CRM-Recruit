import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';

/**
 * Tenant-scoped data access for 'reports'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 *
 * These are deeper, cross-entity cuts than AnalyticsRepository's single-model
 * groupBys (source/owner/company performance, conversion rates) — dev/demo
 * data volumes make JS-side aggregation over a `findMany` simpler and just
 * as fast as a raw SQL join, so that's used wherever Prisma's `groupBy`
 * can't reach across a relation (e.g. Application -> Job -> Company).
 */
@Injectable()
export class ReportsRepository {
  constructor(private readonly db: DatabaseService) {}

  applicationStatusCounts(organisationId: string) {
    return this.db
      .forTenant(organisationId)
      .application.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } });
  }

  applicationsBySource(organisationId: string) {
    return this.db.forTenant(organisationId).application.findMany({
      where: { deletedAt: null },
      select: { source: true, status: true },
    });
  }

  applicationsByOwner(organisationId: string) {
    return this.db.forTenant(organisationId).application.findMany({
      where: { deletedAt: null, ownerId: { not: null } },
      select: { ownerId: true, status: true },
    });
  }

  candidatesByOwnerCount(organisationId: string) {
    return this.db.forTenant(organisationId).candidate.groupBy({
      by: ['ownerId'],
      where: { deletedAt: null, ownerId: { not: null } },
      _count: { _all: true },
    });
  }

  /** Every open-ish company with its job count — companies with zero jobs are dropped downstream, not here, so callers can still see "no pipeline" companies if they want to. */
  companiesWithJobCounts(organisationId: string) {
    return this.db.forTenant(organisationId).company.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, _count: { select: { jobs: true } } },
    });
  }

  applicationsByCompany(organisationId: string) {
    return this.db.forTenant(organisationId).application.findMany({
      where: { deletedAt: null },
      select: { status: true, job: { select: { companyId: true } } },
    });
  }

  /** Every job with its title and company name — jobs with zero applications are dropped downstream, not here. */
  jobsWithCompanyNames(organisationId: string) {
    return this.db.forTenant(organisationId).job.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, company: { select: { name: true } } },
    });
  }

  applicationsByJob(organisationId: string) {
    return this.db.forTenant(organisationId).application.findMany({
      where: { deletedAt: null },
      select: { status: true, jobId: true },
    });
  }

  applicationAppliedDates(organisationId: string) {
    return this.db.forTenant(organisationId).application.findMany({
      where: { deletedAt: null },
      select: { appliedAt: true },
    });
  }

  /** Every org member — see AnalyticsRepository.allUserNames for why this beats a targeted lookup by id: one fewer sequential round-trip against a remote DB. */
  allUserNames(organisationId: string) {
    return this.db.forTenant(organisationId).user.findMany({
      select: { id: true, firstName: true, lastName: true },
    });
  }
}
