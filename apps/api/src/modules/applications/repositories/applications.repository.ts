import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateApplicationDto } from '../dto/create-application.dto';
import type { ListApplicationsQueryDto } from '../dto/list-applications-query.dto';
import type { UpdateApplicationDto } from '../dto/update-application.dto';

const RELATION_INCLUDE = {
  candidate: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
  job: {
    select: {
      id: true,
      title: true,
      status: true,
      company: { select: { id: true, name: true } },
    },
  },
  pipelineStage: { select: { id: true, name: true, type: true, order: true } },
  // the scheme decides what a placed candidate becomes (permanent / temporary employee)
  pipeline: { select: { id: true, name: true, employmentType: true } },
  checklistResponses: {
    select: { id: true, checklistItemId: true, completed: true, completedAt: true },
  },
  // the per-stage records: the board card shows the current stage's outcome (screening passed, offer sent…) and the
  // latest pay recorded, and the pay filter matches on that pay; `notes` is the mandatory free-text reason behind a
  // Reject (see Rejected Applicants). A handful of small rows per application.
  stageNotes: {
    orderBy: { updatedAt: 'desc' as const },
    select: { pipelineStageId: true, notes: true, fields: true, hourlyRate: true, hoursPerDay: true, daysPerMonth: true, feePercent: true, currency: true, updatedAt: true },
  },
};

/**
 * Tenant-scoped data access for 'applications' — the join between Candidate
 * and Job (see schema.prisma's comment on the Application model: a
 * candidate is never linked to a job directly). Always resolve the client
 * via `this.db.forTenant(organisationId)` (packages/database scopedPrisma).
 */
@Injectable()
export class ApplicationsRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  async findMany(organisationId: string, query: ListApplicationsQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = {
      deletedAt: null,
      // a card of a candidate or a job that was deleted is gone with it
      candidate: { deletedAt: null },
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      job: { deletedAt: null, ...(query.companyId ? { companyId: query.companyId } : {}) },
      ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}),
      ...(query.appliedFrom || query.appliedTo
        ? {
            appliedAt: {
              ...(query.appliedFrom ? { gte: new Date(query.appliedFrom) } : {}),
              ...(query.appliedTo ? { lte: new Date(query.appliedTo) } : {}),
            },
          }
        : {}),
      ...(query.minHourlyRate !== undefined || query.maxHourlyRate !== undefined
        ? {
            stageNotes: {
              some: {
                hourlyRate: {
                  ...(query.minHourlyRate !== undefined ? { gte: query.minHourlyRate } : {}),
                  ...(query.maxHourlyRate !== undefined ? { lte: query.maxHourlyRate } : {}),
                },
              },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { candidate: { firstName: { contains: query.search, mode: 'insensitive' as const } } },
              { candidate: { lastName: { contains: query.search, mode: 'insensitive' as const } } },
              { job: { title: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.application.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { appliedAt: 'desc' },
        include: RELATION_INCLUDE,
      }),
      this.cache.cachedCount(organisationId, 'applications', where, () => db.application.count({ where })),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).application.findFirst({
      where: { id, deletedAt: null },
      include: RELATION_INCLUDE,
    });
  }

  /** Same tenant and soft-delete filter as `findById`, but only the pipeline id — for callers that just compare `pipelineId`. */
  findPipelineId(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).application.findFirst({
      where: { id, deletedAt: null },
      select: { pipelineId: true },
    });
  }

  /** Existence check with the same tenant and soft-delete filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .application.count({ where: { id, deletedAt: null } })
      .then((count) => count > 0);
  }

  /** Soft-deleted rows included: (candidateId, jobId) is unique, so a deleted application is restored, never duplicated. */
  findByCandidateAndJob(organisationId: string, candidateId: string, jobId: string) {
    return this.db.forTenant(organisationId).application.findFirst({
      where: { candidateId, jobId },
    });
  }

  /** Brings a soft-deleted application back onto a pipeline. */
  restore(organisationId: string, id: string, data: { pipelineId: string; pipelineStageId: string; ownerId?: string }) {
    return this.db.forTenant(organisationId).application.update({
      where: { id },
      data: { ...data, deletedAt: null, status: 'ACTIVE' },
      include: RELATION_INCLUDE,
    });
  }

  create(organisationId: string, ownerId: string | null, dto: CreateApplicationDto & { pipelineId: string; pipelineStageId: string }) {
    return this.db.forTenant(organisationId).application.create({
      data: { ...dto, organisationId, ownerId: dto.ownerId ?? ownerId },
      include: RELATION_INCLUDE,
    });
  }

  update(organisationId: string, id: string, dto: UpdateApplicationDto) {
    return this.db.forTenant(organisationId).application.update({
      where: { id },
      data: dto,
      include: RELATION_INCLUDE,
    });
  }

  softDelete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).application.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Puts a removed (soft-deleted) application back on its pipeline. Null when it is not this tenant's or was never removed. */
  async restoreRemoved(organisationId: string, id: string) {
    const db = this.db.forTenant(organisationId);
    const removed = await db.application.findFirst({ where: { id, deletedAt: { not: null } }, select: { id: true } });
    if (!removed) return null;
    return db.application.update({ where: { id }, data: { deletedAt: null } });
  }

  /** The org's oldest pipeline (there is exactly one from the seed, but nothing stops a future Pipelines admin UI from adding more) plus its first-ordered stage — the sensible default when a candidate applies without the caller picking one explicitly. */
  async findDefaultPipelineStage(organisationId: string) {
    const pipeline = await this.db.forTenant(organisationId).pipeline.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
    });
    if (!pipeline || pipeline.stages.length === 0) return null;
    return { pipelineId: pipeline.id, pipelineStageId: pipeline.stages[0]!.id };
  }

  createDefaultPipeline(organisationId: string) {
    return this.db.forTenant(organisationId).pipeline.create({
      data: {
        organisationId,
        name: 'Permanent recruitment',
        employmentType: 'PERMANENT',
        stages: {
          // The agency's road from application to decision — each stage has its own form in the web app
          // (features/pipelines/stage-forms.ts), so keep these names in step with it.
          create: [
            { name: 'New', order: 1, type: 'STANDARD' },
            { name: 'Screening', order: 2, type: 'STANDARD' },
            { name: 'Interview', order: 3, type: 'STANDARD' },
            { name: 'Offer', order: 4, type: 'STANDARD' },
            { name: 'Active Employees', order: 5, type: 'PLACED' },
            { name: 'Rejected', order: 6, type: 'REJECTED' },
            { name: 'Completed', order: 7, type: 'STANDARD' },
          ],
        },
      },
      include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
    });
  }

  /**
   * `applicationChecklistItem` carries no organisationId of its own (see the
   * schema comment) — ApplicationsService verifies tenant ownership of both
   * the Application and the checklist item's stage/pipeline before this is
   * ever called, so it deliberately uses the raw, unscoped client.
   */
  toggleChecklistItem(applicationId: string, checklistItemId: string, completed: boolean) {
    return this.db.client.applicationChecklistItem.upsert({
      where: { applicationId_checklistItemId: { applicationId, checklistItemId } },
      create: { applicationId, checklistItemId, completed, completedAt: completed ? new Date() : null },
      update: { completed, completedAt: completed ? new Date() : null },
    });
  }
}
