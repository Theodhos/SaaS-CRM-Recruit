import { monthWindowStart } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly db: DatabaseService) {}

  async dashboardSummary(organisationId: string) {
    const db = this.db.forTenant(organisationId);
    const [candidateCount, openJobCount, activeApplicationCount, placementCount, team] =
      await Promise.all([
        db.candidate.count({ where: { deletedAt: null } }),
        db.job.count({ where: { deletedAt: null, status: 'OPEN' } }),
        db.application.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
        db.placement.count({ where: { status: 'ACTIVE' } }),
        this.teamCounts(organisationId),
      ]);

    return { candidateCount, openJobCount, activeApplicationCount, placementCount, ...team };
  }

  /**
   * Who is working on the platform right now: active accounts, split into admins (holders of `users:manage`, who see
   * the whole organisation) and employees (everyone else, who work in their own book of business). Organisation-wide
   * for every viewer — users are not owner-scoped.
   */
  async teamCounts(organisationId: string) {
    const db = this.db.forTenant(organisationId);
    const isAdmin = { role: { rolePermissions: { some: { permission: { key: 'users:manage' } } } } };
    const [activeUserCount, adminCount] = await Promise.all([
      db.user.count({ where: { status: 'ACTIVE' } }),
      db.user.count({ where: { status: 'ACTIVE', ...isAdmin } }),
    ]);
    return { activeUserCount, adminCount, activeEmployeeCount: activeUserCount - adminCount };
  }

  /** The one `dashboardSummary` figure no `*ByStatus` groupBy in `overview` already carries — same predicate as inside `dashboardSummary`. */
  activeApplicationCount(organisationId: string) {
    return this.db
      .forTenant(organisationId)
      .application.count({ where: { deletedAt: null, status: 'ACTIVE' } });
  }

  candidatesByStatus(organisationId: string) {
    return this.db
      .forTenant(organisationId)
      .candidate.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } });
  }

  jobsByStatus(organisationId: string) {
    return this.db
      .forTenant(organisationId)
      .job.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } });
  }

  companiesByStatus(organisationId: string) {
    return this.db
      .forTenant(organisationId)
      .company.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } });
  }

  placementsByStatus(organisationId: string) {
    return this.db.forTenant(organisationId).placement.groupBy({ by: ['status'], _count: { _all: true } });
  }

  /**
   * Raw start dates, bucketed into months in the service layer — avoids a raw-SQL date_trunc query bypassing the tenant-scoping extension.
   * Only dates inside the bucketing window are fetched (`bucketDatesByMonth` ignores anything older), and no ordering: the buckets are counts.
   */
  async placementStartDates(organisationId: string) {
    const placements = await this.db.forTenant(organisationId).placement.findMany({
      where: { startDate: { gte: monthWindowStart() } },
      select: { startDate: true },
    });
    return placements.map((p) => p.startDate);
  }

  topCompaniesByJobCount(organisationId: string) {
    return this.db.forTenant(organisationId).company.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, _count: { select: { jobs: true } } },
      orderBy: { jobs: { _count: 'desc' } },
      take: 5,
    });
  }

  /** Grouped by stage, not sorted here — the service orders these by the stage's own `order` field so the chart reads as a funnel (New -> ... -> Placed), never resorted by count. */
  async applicationsByPipelineStage(organisationId: string) {
    const db = this.db.forTenant(organisationId);
    const [groups, stages] = await Promise.all([
      db.application.groupBy({
        by: ['pipelineStageId'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      db.pipelineStage.findMany({ select: { id: true, name: true, order: true, type: true } }),
    ]);

    const stageById = new Map(stages.map((s) => [s.id, s]));
    return groups
      .map((g) => {
        const stage = stageById.get(g.pipelineStageId);
        return {
          stageId: g.pipelineStageId,
          name: stage?.name ?? 'Unknown stage',
          order: stage?.order ?? Number.MAX_SAFE_INTEGER,
          type: stage?.type ?? 'STANDARD',
          count: g._count._all,
        };
      })
      .sort((a, b) => a.order - b.order);
  }

  /** Candidates with zero Applications yet — the raw, unrouted pool sitting in Contacts' "unassigned applicants" view before anyone starts a pipeline for them. */
  unassignedCandidateCount(organisationId: string) {
    return this.db.forTenant(organisationId).candidate.count({
      where: { deletedAt: null, applications: { none: {} } },
    });
  }

  candidatesByOwner(organisationId: string) {
    return this.db.forTenant(organisationId).candidate.groupBy({
      by: ['ownerId'],
      where: { deletedAt: null, ownerId: { not: null } },
      _count: { _all: true },
    });
  }

  documentsByType(organisationId: string) {
    return this.db.forTenant(organisationId).document.groupBy({ by: ['type'], _count: { _all: true } });
  }

  /**
   * Every org member, not just the ones referenced in this request — an org
   * realistically has a handful to a few dozen users, so fetching all of
   * them is trivial, and it lets this run inside the same Promise.all batch
   * as everything else instead of a second round-trip once ownerIds are
   * known (real latency against a remote DB, not a micro-optimisation).
   */
  allUserNames(organisationId: string) {
    return this.db.forTenant(organisationId).user.findMany({
      select: { id: true, firstName: true, lastName: true },
    });
  }
}
