import { Prisma } from '@crm/database';
import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { PipelinesService } from '../../pipelines/service/pipelines.service';
import type { CreateChecklistItemDto } from '../dto/create-checklist-item.dto';
import type { CreatePipelineStageDto } from '../dto/create-pipeline-stage.dto';
import type { UpdateChecklistItemDto } from '../dto/update-checklist-item.dto';
import type { UpdatePipelineStageDto } from '../dto/update-pipeline-stage.dto';
import { PipelineStagesRepository } from '../repositories/pipeline-stages.repository';

@Injectable()
export class PipelineStagesService {
  constructor(
    private readonly repository: PipelineStagesRepository,
    // pipelineStage carries no organisationId of its own (see the
    // repository's header comment) — every mutation here must first prove
    // the parent Pipeline belongs to this tenant via PipelinesService,
    // which IS tenant-scoped, before touching the stage itself.
    private readonly pipelinesService: PipelinesService,
  ) {}

  async create(organisationId: string, dto: CreatePipelineStageDto) {
    await this.pipelinesService.assertExists(organisationId, dto.pipelineId);

    let order = dto.order;
    if (order === undefined) {
      const { _max } = await this.repository.maxOrder(dto.pipelineId);
      order = (_max.order ?? 0) + 1;
    }

    return this.wrapOrderConflict(() =>
      this.repository.create({ pipelineId: dto.pipelineId, name: dto.name, order: order!, type: dto.type }),
    );
  }

  async update(organisationId: string, id: string, dto: UpdatePipelineStageDto) {
    const stage = await this.getOwnedStage(organisationId, id);
    return this.wrapOrderConflict(() => this.repository.update(stage.id, dto));
  }

  async remove(organisationId: string, id: string) {
    const stage = await this.getOwnedStage(organisationId, id);
    try {
      await this.repository.delete(stage.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new AppException(
          'STAGE_IN_USE',
          'This stage has applications currently sitting in it — move them to another stage first.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async createChecklistItem(organisationId: string, pipelineStageId: string, dto: CreateChecklistItemDto) {
    const stage = await this.getOwnedStage(organisationId, pipelineStageId);

    let order = dto.order;
    if (order === undefined) {
      const { _max } = await this.repository.maxChecklistItemOrder(stage.id);
      order = (_max.order ?? 0) + 1;
    }

    return this.wrapOrderConflict(() => this.repository.createChecklistItem(stage.id, { ...dto, order: order! }));
  }

  async updateChecklistItem(organisationId: string, id: string, dto: UpdateChecklistItemDto) {
    await this.getOwnedChecklistItem(organisationId, id);
    return this.wrapOrderConflict(() => this.repository.updateChecklistItem(id, dto));
  }

  async removeChecklistItem(organisationId: string, id: string) {
    await this.getOwnedChecklistItem(organisationId, id);
    await this.repository.deleteChecklistItem(id);
  }

  /**
   * Tenant-verified lookup used by ApplicationsService when an applicant
   * toggles a checklist item — proves the item's stage's pipeline belongs to
   * this org before anything is written against it (see the repository's
   * header comment: neither model carries its own organisationId).
   */
  async getOwnedChecklistItem(organisationId: string, id: string) {
    const item = await this.repository.findChecklistItemById(id);
    if (!item) throw new ResourceNotFoundException('PipelineStageChecklistItem', id);
    await this.pipelinesService.assertExists(organisationId, item.pipelineStage.pipelineId);
    return item;
  }

  private async getOwnedStage(organisationId: string, id: string) {
    const stage = await this.repository.findById(id);
    if (!stage) throw new ResourceNotFoundException('PipelineStage', id);
    // Throws ResourceNotFoundException if the stage's pipeline isn't in this org.
    await this.pipelinesService.assertExists(organisationId, stage.pipelineId);
    return stage;
  }

  private async wrapOrderConflict<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          'DUPLICATE_STAGE_ORDER',
          'Another stage in this pipeline already has that position',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }
}
