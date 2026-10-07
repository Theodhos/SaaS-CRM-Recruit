import { totalPages } from '@crm/utils';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { CandidatesService } from '../../candidates/service/candidates.service';
import { JobsService } from '../../jobs/service/jobs.service';
import { PipelineStagesService } from '../../pipeline-stages/service/pipeline-stages.service';
import { PlacementsService } from '../../placements/service/placements.service';
import type { CreateApplicationDto } from '../dto/create-application.dto';
import type { ListApplicationsQueryDto } from '../dto/list-applications-query.dto';
import type { UpdateApplicationDto } from '../dto/update-application.dto';
import { ApplicationsRepository } from '../repositories/applications.repository';

type ApplicationWithRelations = Awaited<ReturnType<ApplicationsRepository['update']>>;

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly repository: ApplicationsRepository,
    private readonly candidatesService: CandidatesService,
    private readonly jobsService: JobsService,
    private readonly placementsService: PlacementsService,
    private readonly pipelineStagesService: PipelineStagesService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(organisationId: string, query: ListApplicationsQueryDto) {
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
    const application = await this.repository.findById(organisationId, id);
    if (!application) throw new ResourceNotFoundException('Application', id);
    return application;
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Application', id);
    }
  }

  /** `userId` is null when the application is raised by the public website form (CandidateIntakeService). */
  async create(organisationId: string, userId: string | null, dto: CreateApplicationDto) {
    // Confirms both belong to this org the same way every other cross-entity
    // FK gets validated elsewhere — getById already throws if either is missing.
    // The duplicate lookup is independent of the two existence checks, so all
    // three run together; a missing candidate/job still throws before the
    // duplicate result is looked at, exactly as before.
    const [, , existing] = await Promise.all([
      this.candidatesService.assertExists(organisationId, dto.candidateId),
      this.jobsService.assertExists(organisationId, dto.jobId),
      this.repository.findByCandidateAndJob(organisationId, dto.candidateId, dto.jobId),
    ]);
    let pipelineId = dto.pipelineId;
    let pipelineStageId = dto.pipelineStageId;
    if (!pipelineId || !pipelineStageId) {
      const defaults = await this.resolveDefaultPipelineStage(organisationId);
      pipelineId = pipelineId ?? defaults.pipelineId;
      pipelineStageId = pipelineStageId ?? defaults.pipelineStageId;
    }

    if (existing?.deletedAt) {
      // The pair (candidate, job) is unique: an application deleted earlier comes back instead of colliding.
      const restored = await this.repository.restore(organisationId, existing.id, {
        pipelineId,
        pipelineStageId,
        ...(dto.ownerId ? { ownerId: dto.ownerId } : {}),
      });
      await this.auditLogs.record({
        organisationId,
        userId,
        action: 'RESTORE_APPLICATION',
        entityType: 'Application',
        entityId: restored.id,
        newValues: { pipelineId, pipelineStageId },
      });
      return (await this.syncStatusWithStage(organisationId, restored)) ?? (await this.maybeAutoPlace(organisationId, userId, restored)) ?? restored;
    }

    if (existing) {
      const closed = existing.status === 'REJECTED' || existing.status === 'WITHDRAWN';
      if (!closed) {
        throw new AppException(
          'DUPLICATE_APPLICATION',
          'This candidate has already applied to this job',
          HttpStatus.CONFLICT,
        );
      }
      // A rejected / withdrawn applicant being added again: re-open the same application at the requested (or first)
      // stage. syncStatusWithStage then flips it back to ACTIVE, so they show as "Active" in Candidates again.
      const reopened = await this.repository.update(organisationId, existing.id, {
        pipelineId,
        pipelineStageId,
        status: 'ACTIVE',
        ...(dto.ownerId ? { ownerId: dto.ownerId } : {}),
      });
      await this.auditLogs.record({
        organisationId,
        userId,
        action: 'REOPEN_APPLICATION',
        entityType: 'Application',
        entityId: reopened.id,
        newValues: { pipelineId, pipelineStageId },
      });
      return (await this.syncStatusWithStage(organisationId, reopened)) ?? (await this.maybeAutoPlace(organisationId, userId, reopened)) ?? reopened;
    }

    const application = await this.repository.create(organisationId, userId, {
      ...dto,
      pipelineId,
      pipelineStageId,
    });

    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_APPLICATION',
      entityType: 'Application',
      entityId: application.id,
      newValues: dto,
    });

    return (await this.syncStatusWithStage(organisationId, application)) ?? (await this.maybeAutoPlace(organisationId, userId, application)) ?? application;
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateApplicationDto) {
    const existing = await this.getById(organisationId, id);
    const application = await this.repository.update(organisationId, id, dto);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_APPLICATION',
      entityType: 'Application',
      entityId: id,
      oldValues: existing,
      newValues: dto,
    });

    return (await this.syncStatusWithStage(organisationId, application)) ?? (await this.maybeAutoPlace(organisationId, userId, application)) ?? application;
  }

  /** Undo of a removal: the card is back on the pipeline, in the stage it was removed from. */
  async restore(organisationId: string, userId: string, id: string) {
    const restored = await this.repository.restoreRemoved(organisationId, id);
    if (!restored) throw new ResourceNotFoundException('Removed application', id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'RESTORE_APPLICATION',
      entityType: 'Application',
      entityId: id,
    });
    return this.getById(organisationId, id);
  }

  async remove(organisationId: string, userId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.softDelete(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_APPLICATION',
      entityType: 'Application',
      entityId: id,
    });
  }

  /**
   * "After going through every pipeline phase and being approved at the
   * end, the company/job assignment happens automatically" — the trigger is
   * the pipeline stage's own `type` (see PipelineStageType), not a status
   * string, so it fires however that stage was reached: this create, an
   * update that changes pipelineStageId, or a future kanban drag-and-drop.
   * Never throws — a job with no company yet just means no Placement can
   * be inferred, not a failed pipeline move.
   */
  /**
   * The applicant's status follows the stage they sit in: a stage of type REJECTED marks the application REJECTED
   * (the candidate then shows as "Rejected" in Candidates); moving them back to a normal stage re-opens it as ACTIVE.
   * PLACED stages are handled by maybeAutoPlace. Returns the refreshed application when it changed anything.
   */
  private async syncStatusWithStage(
    organisationId: string,
    application: ApplicationWithRelations,
  ): Promise<ApplicationWithRelations | null> {
    const stageType = application.pipelineStage.type;
    if (stageType === 'REJECTED' && application.status !== 'REJECTED') {
      return this.repository.update(organisationId, application.id, { status: 'REJECTED' });
    }
    if (stageType === 'STANDARD' && (application.status === 'REJECTED' || application.status === 'WITHDRAWN')) {
      return this.repository.update(organisationId, application.id, { status: 'ACTIVE' });
    }
    return null;
  }

  private async maybeAutoPlace(
    organisationId: string,
    userId: string | null,
    application: ApplicationWithRelations,
  ): Promise<ApplicationWithRelations | null> {
    if (application.pipelineStage.type !== 'PLACED') return null;

    // No acting user (website intake) — the placement is attributed to whoever owns the application.
    const actor = userId ?? application.ownerId;
    if (!actor) {
      this.logger.warn(`Application ${application.id} reached a "Placed" stage with no user or owner to attribute the Placement to.`);
      return null;
    }

    const placement = await this.placementsService.createFromApplicationIfAbsent(organisationId, actor, {
      candidateId: application.candidateId,
      jobId: application.jobId,
      companyId: application.job.company?.id ?? null,
      // the scheme the candidate came through decides: permanent or temporary employee
      employmentType: application.pipeline.employmentType,
    });

    if (!placement) {
      this.logger.warn(
        `Application ${application.id} reached a "Placed" pipeline stage but its job has no company yet — Placement not auto-created.`,
      );
      return null;
    }

    if (application.status !== 'PLACED') {
      return this.repository.update(organisationId, application.id, { status: 'PLACED' });
    }

    return null;
  }

  /**
   * Marks one of the applicant's current pipeline stage's "test/question"
   * checklist items as done or not. Both the Application and the checklist
   * item are verified tenant-owned independently (see their services), and
   * the item must belong to the SAME pipeline this application is actually
   * in — an item from a different pipeline is a client bug, not something
   * to silently accept.
   */
  async toggleChecklistItem(
    organisationId: string,
    applicationId: string,
    checklistItemId: string,
    completed: boolean,
  ) {
    // Only the application's pipeline is compared below, so don't load the whole application with every relation.
    const application = await this.repository.findPipelineId(organisationId, applicationId);
    if (!application) throw new ResourceNotFoundException('Application', applicationId);
    const item = await this.pipelineStagesService.getOwnedChecklistItem(organisationId, checklistItemId);

    if (item.pipelineStage.pipelineId !== application.pipelineId) {
      throw new AppException(
        'CHECKLIST_ITEM_WRONG_PIPELINE',
        'This checklist item belongs to a different pipeline than this application.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.repository.toggleChecklistItem(applicationId, checklistItemId, completed);
  }

  /** A fresh organisation has no pipeline yet (the current seed creates one, but a real signup won't) — provision the same default shape on first use rather than making "create a pipeline" a prerequisite step before anyone can record an application. */
  private async resolveDefaultPipelineStage(organisationId: string) {
    const existing = await this.repository.findDefaultPipelineStage(organisationId);
    if (existing) return existing;

    const created = await this.repository.createDefaultPipeline(organisationId);
    return { pipelineId: created.id, pipelineStageId: created.stages[0]!.id };
  }
}
