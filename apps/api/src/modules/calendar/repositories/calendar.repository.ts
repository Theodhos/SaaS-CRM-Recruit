import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateCalendarEventDto } from '../dto/create-calendar-event.dto';
import type { ListCalendarEventsQueryDto } from '../dto/list-calendar-events-query.dto';
import type { UpdateCalendarEventDto } from '../dto/update-calendar-event.dto';

const RELATION_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true } },
  candidate: { select: { id: true, firstName: true, lastName: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  job: { select: { id: true, title: true } },
  application: { select: { id: true } },
};

/**
 * Tenant-scoped data access for 'calendar_events'. Always resolve via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma).
 */
@Injectable()
export class CalendarRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(organisationId: string, query: ListCalendarEventsQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.applicationId ? { applicationId: query.applicationId } : {}),
      ...(query.from || query.to
        ? {
            startAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.calendarEvent.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { startAt: 'asc' },
        include: RELATION_INCLUDE,
      }),
      db.calendarEvent.count({ where }),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).calendarEvent.findFirst({
      where: { id },
      include: RELATION_INCLUDE,
    });
  }

  /** Existence check with the same tenant filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .calendarEvent.count({ where: { id } })
      .then((count) => count > 0);
  }

  create(organisationId: string, userId: string, dto: CreateCalendarEventDto) {
    return this.db.forTenant(organisationId).calendarEvent.create({
      data: {
        ...dto,
        organisationId,
        userId: dto.userId ?? userId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
      },
      include: RELATION_INCLUDE,
    });
  }

  update(organisationId: string, id: string, dto: UpdateCalendarEventDto) {
    return this.db.forTenant(organisationId).calendarEvent.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.startAt ? { startAt: new Date(dto.startAt) } : {}),
        ...(dto.endAt ? { endAt: new Date(dto.endAt) } : {}),
      },
      include: RELATION_INCLUDE,
    });
  }

  delete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).calendarEvent.delete({ where: { id } });
  }

  /**
   * Deliberately unscoped (raw client, not `forTenant`) — CalendarRemindersService's
   * cron sweep runs on a timer, not inside a request, so there is no single
   * organisationId to scope to; it needs every org's due events in one pass.
   * Never copy this pattern into a request-handling path.
   */
  findDueForReminder(from: Date, to: Date) {
    return this.db.client.calendarEvent.findMany({
      where: {
        status: 'SCHEDULED',
        reminderSentAt: null,
        startAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        organisationId: true,
        title: true,
        startAt: true,
        meetingUrl: true,
        userId: true,
      },
    });
  }

  markReminderSent(id: string) {
    return this.db.client.calendarEvent.update({
      where: { id },
      data: { reminderSentAt: new Date() },
    });
  }
}
