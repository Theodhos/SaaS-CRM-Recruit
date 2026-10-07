import { totalPages } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { CandidatesService } from '../../candidates/service/candidates.service';
import { CompaniesService } from '../../companies/service/companies.service';
import { JobsService } from '../../jobs/service/jobs.service';
import { NotificationsService } from '../../notifications/service/notifications.service';
import type { CreatePlacementDto } from '../dto/create-placement.dto';
import type { ListPlacementsQueryDto } from '../dto/list-placements-query.dto';
import type { UpdatePlacementDto } from '../dto/update-placement.dto';
import { PlacementsRepository } from '../repositories/placements.repository';

@Injectable()
export class PlacementsService {
  constructor(
    private readonly repository: PlacementsRepository,
    private readonly candidatesService: CandidatesService,
    private readonly jobsService: JobsService,
    private readonly companiesService: CompaniesService,
    private readonly auditLogs: AuditLogsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(organisationId: string, query: ListPlacementsQueryDto) {
    const { items, totalItems } = await this.repository.findMany(organisationId, query);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  async getById(organisationId: string, id: string) {
    const placement = await this.repository.findById(organisationId, id);
    if (!placement) throw new ResourceNotFoundException('Placement', id);
    return placement;
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Placement', id);
    }
  }

  async create(organisationId: string, userId: string, dto: CreatePlacementDto) {
    // Getting each by id (rather than a lighter existence check) also
    // confirms it belongs to this organisation — the same tenant-scoped
    // lookup every other module already relies on for that.
    const [candidate, job, company] = await Promise.all([
      this.candidatesService.getById(organisationId, dto.candidateId),
      this.jobsService.getById(organisationId, dto.jobId),
      this.companiesService.getById(organisationId, dto.companyId),
    ]);

    const placement = await this.repository.create(organisationId, userId, dto);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_PLACEMENT',
      entityType: 'Placement',
      entityId: placement.id,
      newValues: dto,
    });

    // A placement is worth notifying its owner about even when they're the
    // one who just created it (e.g. auto-placement fires from whoever moved
    // the pipeline stage, not necessarily the recruiter who owns the deal).
    if (placement.ownerId) {
      await this.notifications.notify(organisationId, placement.ownerId, {
        type: 'CANDIDATE_PLACED',
        title: `${candidate.firstName} ${candidate.lastName} placed at ${company.name}`,
        message: job.title,
        link: `/candidates/${candidate.id}`,
      });
    }

    return placement;
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdatePlacementDto) {
    const existing = await this.getById(organisationId, id);
    const placement = await this.repository.update(organisationId, id, dto);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_PLACEMENT',
      entityType: 'Placement',
      entityId: id,
      oldValues: existing,
      newValues: dto,
    });
    return placement;
  }

  async remove(organisationId: string, userId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.remove(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_PLACEMENT',
      entityType: 'Placement',
      entityId: id,
    });
  }

  /**
   * Called by ApplicationsService when an Application's pipeline stage
   * turns into a `type: 'PLACED'` stage — the automatic side of "once
   * approved through every pipeline phase, the company/job assignment
   * happens automatically" (an admin can still edit or delete the
   * resulting Placement by hand afterward through the normal endpoints;
   * this only ever creates the first one).
   *
   * Returns `null` (never throws) when a Placement can't be inferred yet —
   * the job has no companyId — so a pipeline-stage update never fails just
   * because auto-placement isn't possible; the recruiter assigns a company
   * to the job and moves the stage again, or creates the Placement by hand.
   */
  async createFromApplicationIfAbsent(
    organisationId: string,
    userId: string,
    params: { candidateId: string; jobId: string; companyId: string | null; employmentType?: 'PERMANENT' | 'TEMPORARY' },
  ) {
    if (!params.companyId) return null;

    const existing = await this.repository.findByCandidateAndJob(
      organisationId,
      params.candidateId,
      params.jobId,
    );
    if (existing) return existing;

    return this.create(organisationId, userId, {
      candidateId: params.candidateId,
      jobId: params.jobId,
      companyId: params.companyId,
      startDate: new Date().toISOString(),
      status: 'ACTIVE',
      employmentType: params.employmentType,
    });
  }
}
