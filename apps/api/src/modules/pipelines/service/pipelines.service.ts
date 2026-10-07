import { Prisma } from '@crm/database';
import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import type { CreatePipelineDto } from '../dto/create-pipeline.dto';
import type { UpdatePipelineDto } from '../dto/update-pipeline.dto';
import { PipelinesRepository } from '../repositories/pipelines.repository';

@Injectable()
export class PipelinesService {
  constructor(private readonly repository: PipelinesRepository) {}

  list(organisationId: string) {
    return this.repository.findMany(organisationId);
  }

  async getById(organisationId: string, id: string) {
    const pipeline = await this.repository.findById(organisationId, id);
    if (!pipeline) throw new ResourceNotFoundException('Pipeline', id);
    return pipeline;
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Pipeline', id);
    }
  }

  create(organisationId: string, dto: CreatePipelineDto) {
    assertUniqueOrders(dto.stages.map((s) => s.order));
    return this.repository.create(organisationId, dto);
  }

  async update(organisationId: string, id: string, dto: UpdatePipelineDto) {
    await this.assertExists(organisationId, id);
    return this.repository.update(organisationId, id, dto);
  }

  async remove(organisationId: string, id: string) {
    await this.assertExists(organisationId, id);
    try {
      await this.repository.delete(organisationId, id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new AppException(
          'PIPELINE_IN_USE',
          'This pipeline has applications of other users on it and cannot be deleted — ask an admin to delete it.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }
}

function assertUniqueOrders(orders: number[]) {
  if (new Set(orders).size !== orders.length) {
    throw new AppException(
      'DUPLICATE_STAGE_ORDER',
      'Each pipeline stage needs a distinct order position',
      HttpStatus.BAD_REQUEST,
    );
  }
}
