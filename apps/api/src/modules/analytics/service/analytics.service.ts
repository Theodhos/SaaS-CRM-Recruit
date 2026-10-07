import { bucketDatesByMonth, withPercentages } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { AnalyticsRepository } from '../repositories/analytics.repository';

export interface StatusCount {
  status: string;
  count: number;
  percentage: number;
}

function toPercentageBreakdown(groups: { status: string; _count: { _all: number } }[]): StatusCount[] {
  return withPercentages(groups.map((g) => ({ status: g.status, count: g._count._all }))).sort(
    (a, b) => b.count - a.count,
  );
}

/** Upper bound on staleness for writes that bypass the API; writes through the API invalidate immediately. */
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS ?? 30);

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly cache: CacheService,
  ) {}

  // Cache-aside (opt-in, CACHE_ENABLED=true): the dashboard aggregates scan whole tables, so at large tenants
  // they are computed once per tenant-version instead of on every page load. Identical result either way.
  dashboardSummary(organisationId: string) {
    return this.cache.wrap(organisationId, 'analytics:dashboard-summary', CACHE_TTL_SECONDS, () =>
      this.repository.dashboardSummary(organisationId),
    );
  }

  overview(organisationId: string) {
    return this.cache.wrap(organisationId, 'analytics:overview', CACHE_TTL_SECONDS, () =>
      this.computeOverview(organisationId),
    );
  }

  private async computeOverview(organisationId: string) {
    // Split into two waves rather than firing all ~12 queries (dashboardSummary
    // alone is 4 more) at once: against a remote pooled DB (Supabase/Supavisor),
    // that many simultaneous new connections queue at the pooler and end up
    // *slower* in wall-clock time than two smaller, fully-parallel batches.
    const [
      activeApplicationCount,
      team,
      candidateGroups,
      jobGroups,
      companyGroups,
      placementGroups,
      documentGroups,
    ] =
      await Promise.all([
        this.repository.activeApplicationCount(organisationId),
        this.repository.teamCounts(organisationId),
        this.repository.candidatesByStatus(organisationId),
        this.repository.jobsByStatus(organisationId),
        this.repository.companiesByStatus(organisationId),
        this.repository.placementsByStatus(organisationId),
        this.repository.documentsByType(organisationId),
      ]);

    const [
      placementDates,
      topCompanies,
      ownerGroups,
      pipelineStageGroups,
      unassignedCandidateCount,
      owners,
    ] = await Promise.all([
      this.repository.placementStartDates(organisationId),
      this.repository.topCompaniesByJobCount(organisationId),
      this.repository.candidatesByOwner(organisationId),
      this.repository.applicationsByPipelineStage(organisationId),
      this.repository.unassignedCandidateCount(organisationId),
      this.repository.allUserNames(organisationId),
    ]);

    const ownerNameById = new Map(owners.map((o) => [o.id, `${o.firstName} ${o.lastName}`]));

    // Same four figures `dashboardSummary` returns, read off the groupBys above
    // (identical predicates: live candidates / live OPEN jobs / ACTIVE placements)
    // instead of re-counting each one — same values, three fewer queries.
    const countOf = (groups: { status: string; _count: { _all: number } }[], status: string) =>
      groups.find((g) => g.status === status)?._count._all ?? 0;
    const summary = {
      candidateCount: candidateGroups.reduce((sum, g) => sum + g._count._all, 0),
      openJobCount: countOf(jobGroups, 'OPEN'),
      activeApplicationCount,
      placementCount: countOf(placementGroups, 'ACTIVE'),
      ...team,
    };

    return {
      summary,
      candidatesByStatus: toPercentageBreakdown(candidateGroups),
      jobsByStatus: toPercentageBreakdown(jobGroups),
      companiesByStatus: toPercentageBreakdown(companyGroups),
      placementsByStatus: toPercentageBreakdown(placementGroups),
      documentsByType: toPercentageBreakdown(documentGroups.map((g) => ({ status: g.type, _count: g._count }))),
      placementsByMonth: bucketDatesByMonth(placementDates),
      topCompaniesByJobs: topCompanies.map((c) => ({ name: c.name, jobCount: c._count.jobs })),
      candidatesByOwner: ownerGroups
        .map((g) => ({
          owner: g.ownerId ? (ownerNameById.get(g.ownerId) ?? 'Unknown') : 'Unassigned',
          count: g._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      // Kept in pipeline order (not sorted by count) so this reads as a funnel.
      applicationsByPipelineStage: withPercentages(
        pipelineStageGroups.map((g) => ({ status: g.name, count: g.count, isTerminal: g.type !== 'STANDARD' })),
      ),
      unassignedCandidateCount,
    };
  }
}
