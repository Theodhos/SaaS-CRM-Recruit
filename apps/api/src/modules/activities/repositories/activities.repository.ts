import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateActivityDto } from '../dto/create-activity.dto';
import type { ListActivitiesQueryDto } from '../dto/list-activities-query.dto';
import type { UpdateActivityDto } from '../dto/update-activity.dto';

const RELATION_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true } },
  candidate: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true, companyId: true } },
  job: { select: { id: true, title: true } },
  application: { select: { id: true } },
};

/**
 * Tenant-scoped data access for 'activities' — the CRM interaction log
 * (calls, emails, meetings, notes) against a candidate, contact, company,
 * job, or application. Always resolve via `this.db.forTenant(organisationId)`.
 */
@Injectable()
export class ActivitiesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(organisationId: string, query: ListActivitiesQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.applicationId ? { applicationId: query.applicationId } : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.activity.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: RELATION_INCLUDE,
      }),
      db.activity.count({ where }),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).activity.findFirst({
      where: { id },
      include: RELATION_INCLUDE,
    });
  }

  /** Existence check with the same tenant filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .activity.count({ where: { id } })
      .then((count) => count > 0);
  }

  create(organisationId: string, userId: string, dto: CreateActivityDto) {
    return this.db.forTenant(organisationId).activity.create({
      data: {
        ...dto,
        organisationId,
        userId: dto.userId ?? userId,
        ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
        ...(dto.completedAt ? { completedAt: new Date(dto.completedAt) } : {}),
      },
      include: RELATION_INCLUDE,
    });
  }

  update(organisationId: string, id: string, dto: UpdateActivityDto) {
    return this.db.forTenant(organisationId).activity.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
        ...(dto.completedAt ? { completedAt: new Date(dto.completedAt) } : {}),
      },
      include: RELATION_INCLUDE,
    });
  }

  delete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).activity.delete({ where: { id } });
  }
}
