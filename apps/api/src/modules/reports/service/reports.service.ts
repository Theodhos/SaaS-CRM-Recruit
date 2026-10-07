import { bucketDatesByMonth, conversionRate, withPercentages } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { ReportsRepository } from '../repositories/reports.repository';

const PLACED_STATUS = 'PLACED';

/** Upper bound on staleness for writes that bypass the API; writes through the API invalidate immediately. */
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS ?? 30);

@Injectable()
export class ReportsService {
  constructor(
    private readonly repository: ReportsRepository,
    private readonly cache: CacheService,
  ) {}

  // Cache-aside (opt-in, CACHE_ENABLED=true). This report reads every application of the tenant into memory
  // (~14 s and ~3 GB at 800k applications), so computing it once per tenant-version instead of on every dashboard
  // load matters. Identical result either way. The computation itself is unchanged: an experiment that merged its
  // five parallel scans into one cut memory but made a single request slower (14 s -> 24 s), so it was reverted.
  overview(organisationId: string) {
    return this.cache.wrap(organisationId, 'reports:overview', CACHE_TTL_SECONDS, () =>
      this.computeOverview(organisationId),
    );
  }

  private async computeOverview(organisationId: string) {
    const [
      statusGroups,
      bySource,
      byOwner,
      candidatesByOwner,
      companies,
      applicationsByCompany,
      jobs,
      applicationsByJob,
      appliedDates,
      owners,
    ] = await Promise.all([
      this.repository.applicationStatusCounts(organisationId),
      this.repository.applicationsBySource(organisationId),
      this.repository.applicationsByOwner(organisationId),
      this.repository.candidatesByOwnerCount(organisationId),
      this.repository.companiesWithJobCounts(organisationId),
      this.repository.applicationsByCompany(organisationId),
      this.repository.jobsWithCompanyNames(organisationId),
      this.repository.applicationsByJob(organisationId),
      this.repository.applicationAppliedDates(organisationId),
      this.repository.allUserNames(organisationId),
    ]);

    const ownerNameById = new Map(owners.map((o) => [o.id, `${o.firstName} ${o.lastName}`]));

    return {
      outcomeSummary: withPercentages(
        statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      ).sort((a, b) => b.count - a.count),

      sourceEffectiveness: this.groupConversion(bySource, (a) => a.source),

      ownerPerformance: this.ownerPerformance(byOwner, candidatesByOwner, ownerNameById),

      companyPerformance: this.companyPerformance(companies, applicationsByCompany),

      jobPerformance: this.jobPerformance(jobs, applicationsByJob),

      applicationsByMonth: bucketDatesByMonth(appliedDates.map((a) => a.appliedAt)),
    };
  }

  /** Generic "N attempts -> M placed -> conversion %" grouped by an arbitrary key (source, owner id, company id, ...). */
  private groupConversion<T extends { status: string }>(
    rows: T[],
    keyOf: (row: T) => string,
  ): { key: string; applications: number; placements: number; conversionRate: number }[] {
    const byKey = new Map<string, { applications: number; placements: number }>();
    for (const row of rows) {
      const key = keyOf(row);
      const bucket = byKey.get(key) ?? { applications: 0, placements: 0 };
      bucket.applications += 1;
      if (row.status === PLACED_STATUS) bucket.placements += 1;
      byKey.set(key, bucket);
    }
    return [...byKey.entries()]
      .map(([key, { applications, placements }]) => ({
        key,
        applications,
        placements,
        conversionRate: conversionRate(placements, applications),
      }))
      .sort((a, b) => b.applications - a.applications);
  }

  private ownerPerformance(
    byOwner: { ownerId: string | null; status: string }[],
    candidatesByOwner: { ownerId: string | null; _count: { _all: number } }[],
    ownerNameById: Map<string, string>,
  ) {
    const rows = byOwner.filter(
      (a): a is { ownerId: string; status: string } => a.ownerId !== null,
    );
    const performance = this.groupConversion(rows, (a) => a.ownerId);
    const candidateCountByOwnerId = new Map(candidatesByOwner.map((c) => [c.ownerId, c._count._all]));

    return performance
      .map((p) => ({
        owner: ownerNameById.get(p.key) ?? 'Unknown',
        candidates: candidateCountByOwnerId.get(p.key) ?? 0,
        applications: p.applications,
        placements: p.placements,
        conversionRate: p.conversionRate,
      }))
      .sort((a, b) => b.applications - a.applications);
  }

  private companyPerformance(
    companies: { id: string; name: string; _count: { jobs: number } }[],
    applicationsByCompany: { status: string; job: { companyId: string | null } | null }[],
  ) {
    const rows = applicationsByCompany.filter(
      (a): a is { status: string; job: { companyId: string } } => !!a.job?.companyId,
    );
    const performance = this.groupConversion(rows, (a) => a.job.companyId);
    const performanceByCompanyId = new Map(performance.map((p) => [p.key, p]));

    return companies
      .map((c) => {
        const p = performanceByCompanyId.get(c.id);
        return {
          company: c.name,
          jobs: c._count.jobs,
          applications: p?.applications ?? 0,
          placements: p?.placements ?? 0,
          conversionRate: p?.conversionRate ?? 0,
        };
      })
      .filter((c) => c.jobs > 0 || c.applications > 0)
      .sort((a, b) => b.applications - a.applications)
      .slice(0, 10);
  }

  private jobPerformance(
    jobs: { id: string; title: string; company: { name: string } | null }[],
    applicationsByJob: { status: string; jobId: string }[],
  ) {
    const performance = this.groupConversion(applicationsByJob, (a) => a.jobId);
    const performanceByJobId = new Map(performance.map((p) => [p.key, p]));

    return jobs
      .map((j) => {
        const p = performanceByJobId.get(j.id);
        return {
          job: j.title,
          company: j.company?.name ?? 'Unassigned',
          applications: p?.applications ?? 0,
          placements: p?.placements ?? 0,
          conversionRate: p?.conversionRate ?? 0,
        };
      })
      .filter((j) => j.applications > 0)
      .sort((a, b) => b.applications - a.applications)
      .slice(0, 10);
  }
}
