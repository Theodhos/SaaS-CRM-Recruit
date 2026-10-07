import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreatePipelineDto } from '../dto/create-pipeline.dto';
import type { UpdatePipelineDto } from '../dto/update-pipeline.dto';

const STAGES_INCLUDE = {
  stages: {
    orderBy: { order: 'asc' as const },
    include: { checklistItems: { orderBy: { order: 'asc' as const } } },
  },
};

/**
 * Tenant-scoped data access for 'pipelines'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 *
 * `pipelineStage` is NOT in the tenant-scoped model list (it has no
 * `organisationId` column of its own — only `pipeline` does), so it is
 * never queried from here directly. See PipelineStagesRepository, which
 * always verifies the parent Pipeline's tenant ownership first.
 */
@Injectable()
export class PipelinesRepository {
  constructor(private readonly db: DatabaseService) {}

  findMany(organisationId: string) {
    return this.db.forTenant(organisationId).pipeline.findMany({
      orderBy: { createdAt: 'asc' },
      include: STAGES_INCLUDE,
    });
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).pipeline.findFirst({
      where: { id },
      include: STAGES_INCLUDE,
    });
  }

  /** Existence check with the same tenant filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .pipeline.count({ where: { id } })
      .then((count) => count > 0);
  }

  create(organisationId: string, dto: CreatePipelineDto) {
    return this.db.forTenant(organisationId).pipeline.create({
      data: {
        organisationId,
        name: dto.name,
        description: dto.description,
        employmentType: dto.employmentType,
        stages: { create: dto.stages.map((s) => ({ name: s.name, order: s.order, type: s.type })) },
      },
      include: STAGES_INCLUDE,
    });
  }

  update(organisationId: string, id: string, dto: UpdatePipelineDto) {
    return this.db.forTenant(organisationId).pipeline.update({
      where: { id },
      data: dto,
      include: STAGES_INCLUDE,
    });
  }

  /**
   * Deletes the pipeline together with the applications on it (and, by cascade, their stage notes, checklist
   * answers and interviews). The candidates themselves stay. One transaction: a pipeline is never left half-emptied.
   */
  async delete(organisationId: string, id: string) {
    const db = this.db.forTenant(organisationId);
    const [applications] = await db.$transaction([
      db.application.deleteMany({ where: { pipelineId: id } }),
      db.pipeline.delete({ where: { id } }),
    ]);
    return { deletedApplications: applications.count };
  }
}
