import { totalPages } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { NotificationsService } from '../../notifications/service/notifications.service';
import type { CreateTaskDto } from '../dto/create-task.dto';
import type { ListTasksQueryDto } from '../dto/list-tasks-query.dto';
import type { UpdateTaskDto } from '../dto/update-task.dto';
import { TasksRepository } from '../repositories/tasks.repository';

@Injectable()
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async list(organisationId: string, query: ListTasksQueryDto) {
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
    const task = await this.repository.findById(organisationId, id);
    if (!task) throw new ResourceNotFoundException('Task', id);
    return task;
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Task', id);
    }
  }

  async create(organisationId: string, userId: string, dto: CreateTaskDto) {
    const task = await this.repository.create(organisationId, userId, dto);

    // Only worth a notification when handed to someone else — assigning
    // yourself a task is not news.
    if (task.assignedToId !== userId) {
      await this.notifications.notify(organisationId, task.assignedToId, {
        type: 'TASK_ASSIGNED',
        title: `New task: ${task.title}`,
        message: task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : undefined,
        link: `/tasks?taskId=${task.id}`,
      });
    }

    return task;
  }

  async update(organisationId: string, id: string, dto: UpdateTaskDto) {
    // Only the current assignee is needed (compared below), not the full task with every relation.
    const existing = await this.repository.findAssignedToId(organisationId, id);
    if (!existing) throw new ResourceNotFoundException('Task', id);
    const task = await this.repository.update(organisationId, id, dto);

    // Reassigned to someone new — same "you've got a task" notification as create.
    if (dto.assignedToId && dto.assignedToId !== existing.assignedToId) {
      await this.notifications.notify(organisationId, task.assignedToId, {
        type: 'TASK_ASSIGNED',
        title: `Task reassigned to you: ${task.title}`,
        message: task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : undefined,
        link: `/tasks?taskId=${task.id}`,
      });
    }

    return task;
  }

  async remove(organisationId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.delete(organisationId, id);
  }
}
