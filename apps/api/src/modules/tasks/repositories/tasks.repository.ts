import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateTaskDto } from '../dto/create-task.dto';
import type { ListTasksQueryDto } from '../dto/list-tasks-query.dto';
import type { UpdateTaskDto } from '../dto/update-task.dto';

const RELATION_INCLUDE = {
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  candidate: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  job: { select: { id: true, title: true } },
  application: { select: { id: true } },
};

/**
 * Tenant-scoped data access for 'tasks'. Always resolve via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma).
 */
@Injectable()
export class TasksRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(organisationId: string, query: ListTasksQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.applicationId ? { applicationId: query.applicationId } : {}),
      ...(query.overdue
        ? {
            dueDate: { lt: new Date() },
            status: { notIn: ['COMPLETED', 'CANCELLED'] as Array<'COMPLETED' | 'CANCELLED'> },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.task.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        include: RELATION_INCLUDE,
      }),
      db.task.count({ where }),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).task.findFirst({
      where: { id },
      include: RELATION_INCLUDE,
    });
  }

  /** Same tenant filter as `findById`, but only the assignee — for callers that just need to compare `assignedToId`. */
  findAssignedToId(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).task.findFirst({
      where: { id },
      select: { assignedToId: true },
    });
  }

  /** Existence check with the same tenant filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .task.count({ where: { id } })
      .then((count) => count > 0);
  }

  create(organisationId: string, userId: string, dto: CreateTaskDto) {
    return this.db.forTenant(organisationId).task.create({
      data: {
        ...dto,
        organisationId,
        createdById: userId,
        assignedToId: dto.assignedToId ?? userId,
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
      },
      include: RELATION_INCLUDE,
    });
  }

  update(organisationId: string, id: string, dto: UpdateTaskDto) {
    return this.db.forTenant(organisationId).task.update({
      where: { id },
      data: {
        ...dto,
        // A rescheduled due date gets a fresh chance to notify once it
        // actually passes — otherwise a task overdue once, then pushed out,
        // would never remind again even after it slips past the new date.
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate), overdueNotifiedAt: null } : {}),
      },
      include: RELATION_INCLUDE,
    });
  }

  delete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).task.delete({ where: { id } });
  }

  /**
   * Deliberately unscoped (raw client, not `forTenant`) — TasksRemindersService's
   * cron sweep runs on a timer, not inside a request, so there is no single
   * organisationId to scope to; it needs every org's overdue tasks in one
   * pass. Never copy this pattern into a request-handling path.
   */
  findOverdueUnnotified(now: Date) {
    return this.db.client.task.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        overdueNotifiedAt: null,
      },
      select: { id: true, organisationId: true, title: true, dueDate: true, assignedToId: true },
    });
  }

  markOverdueNotified(id: string) {
    return this.db.client.task.update({
      where: { id },
      data: { overdueNotifiedAt: new Date() },
    });
  }
}
