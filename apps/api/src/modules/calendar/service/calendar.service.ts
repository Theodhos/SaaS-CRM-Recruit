import { totalPages } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { NotificationsService } from '../../notifications/service/notifications.service';
import type { CreateCalendarEventDto } from '../dto/create-calendar-event.dto';
import type { ListCalendarEventsQueryDto } from '../dto/list-calendar-events-query.dto';
import type { UpdateCalendarEventDto } from '../dto/update-calendar-event.dto';
import { CalendarRepository } from '../repositories/calendar.repository';

const EVENT_TYPE_LABEL: Record<string, string> = {
  INTERVIEW: 'Interview',
  MEETING: 'Meeting',
  CALL: 'Call',
};

@Injectable()
export class CalendarService {
  constructor(
    private readonly repository: CalendarRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async list(organisationId: string, query: ListCalendarEventsQueryDto) {
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
    const event = await this.repository.findById(organisationId, id);
    if (!event) throw new ResourceNotFoundException('CalendarEvent', id);
    return event;
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('CalendarEvent', id);
    }
  }

  async create(organisationId: string, userId: string, dto: CreateCalendarEventDto) {
    const event = await this.repository.create(organisationId, userId, dto);

    // Only worth a notification when put on someone else's calendar —
    // scheduling your own event is not news (same rule as TasksService).
    if (event.userId !== userId) {
      const label = EVENT_TYPE_LABEL[event.type] ?? 'Event';
      await this.notifications.notify(organisationId, event.userId, {
        type: `${event.type}_SCHEDULED`,
        title: `${label} scheduled: ${event.title}`,
        message: new Date(event.startAt).toLocaleString([], {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        link: `/calendar?eventId=${event.id}`,
      });
    }

    return event;
  }

  async update(organisationId: string, id: string, dto: UpdateCalendarEventDto) {
    await this.assertExists(organisationId, id);
    return this.repository.update(organisationId, id, dto);
  }

  async remove(organisationId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.delete(organisationId, id);
  }
}
