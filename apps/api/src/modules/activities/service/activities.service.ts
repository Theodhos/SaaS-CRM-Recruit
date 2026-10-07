import { totalPages } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import type { CreateActivityDto } from '../dto/create-activity.dto';
import type { ListActivitiesQueryDto } from '../dto/list-activities-query.dto';
import type { UpdateActivityDto } from '../dto/update-activity.dto';
import { ActivitiesRepository } from '../repositories/activities.repository';

@Injectable()
export class ActivitiesService {
  constructor(private readonly repository: ActivitiesRepository) {}

  async list(organisationId: string, query: ListActivitiesQueryDto) {
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
    const activity = await this.repository.findById(organisationId, id);
    if (!activity) throw new ResourceNotFoundException('Activity', id);
    return activity;
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Activity', id);
    }
  }

  create(organisationId: string, userId: string, dto: CreateActivityDto) {
    return this.repository.create(organisationId, userId, dto);
  }

  async update(organisationId: string, id: string, dto: UpdateActivityDto) {
    await this.assertExists(organisationId, id);
    return this.repository.update(organisationId, id, dto);
  }

  async remove(organisationId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.delete(organisationId, id);
  }
}
