import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateChecklistItemDto } from '../dto/create-checklist-item.dto';
import type { UpdateChecklistItemDto } from '../dto/update-checklist-item.dto';
import type { UpdatePipelineStageDto } from '../dto/update-pipeline-stage.dto';

/**
 * Data access for 'pipeline_stages'. `pipelineStage` has no `organisationId`
 * column of its own (only its parent `pipeline` does), so it is NOT in
 * scopedPrisma's tenant-scoped model list — this repository deliberately
 * uses `db.client` (the raw, unscoped Prisma client) rather than
 * `db.forTenant(...)`. PipelineStagesService is responsible for verifying
 * the parent Pipeline's tenant ownership (via PipelinesService) before
 * calling any method here. Never call this repository directly from a
 * controller.
 */
@Injectable()
export class PipelineStagesRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: string) {
    return this.db.client.pipelineStage.findUnique({ where: { id } });
  }

  maxOrder(pipelineId: string) {
    return this.db.client.pipelineStage.aggregate({
      where: { pipelineId },
      _max: { order: true },
    });
  }

  create(data: {
    pipelineId: string;
    name: string;
    order: number;
    type?: 'STANDARD' | 'PLACED' | 'REJECTED';
  }) {
    return this.db.client.pipelineStage.create({ data });
  }

  update(id: string, dto: UpdatePipelineStageDto) {
    return this.db.client.pipelineStage.update({ where: { id }, data: dto });
  }

  delete(id: string) {
    return this.db.client.pipelineStage.delete({ where: { id } });
  }

  findChecklistItemById(id: string) {
    return this.db.client.pipelineStageChecklistItem.findUnique({
      where: { id },
      include: { pipelineStage: { select: { pipelineId: true } } },
    });
  }

  maxChecklistItemOrder(pipelineStageId: string) {
    return this.db.client.pipelineStageChecklistItem.aggregate({
      where: { pipelineStageId },
      _max: { order: true },
    });
  }

  createChecklistItem(pipelineStageId: string, dto: CreateChecklistItemDto & { order: number }) {
    return this.db.client.pipelineStageChecklistItem.create({
      data: { pipelineStageId, label: dto.label, order: dto.order },
    });
  }

  updateChecklistItem(id: string, dto: UpdateChecklistItemDto) {
    return this.db.client.pipelineStageChecklistItem.update({ where: { id }, data: dto });
  }

  deleteChecklistItem(id: string) {
    return this.db.client.pipelineStageChecklistItem.delete({ where: { id } });
  }
}
