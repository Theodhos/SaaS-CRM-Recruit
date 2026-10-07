import { totalPages } from '@crm/utils';
import { Injectable, Logger } from '@nestjs/common';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import type { ListNotificationsQueryDto } from '../dto/list-notifications-query.dto';
import { NotificationsRepository } from '../repositories/notifications.repository';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly repository: NotificationsRepository) {}

  async list(organisationId: string, userId: string, query: ListNotificationsQueryDto) {
    const { items, totalItems } = await this.repository.findMany(organisationId, userId, query);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  unreadCount(organisationId: string, userId: string) {
    return this.repository.countUnread(organisationId, userId);
  }

  async markRead(organisationId: string, userId: string, id: string) {
    const notification = await this.repository.findById(organisationId, userId, id);
    if (!notification) throw new ResourceNotFoundException('Notification', id);
    return this.repository.markRead(organisationId, id);
  }

  markAllRead(organisationId: string, userId: string) {
    return this.repository.markAllRead(organisationId, userId);
  }

  async remove(organisationId: string, userId: string, id: string) {
    const notification = await this.repository.findById(organisationId, userId, id);
    if (!notification) throw new ResourceNotFoundException('Notification', id);
    await this.repository.delete(organisationId, id);
  }

  /**
   * The one entry point every other module calls to raise a notification —
   * see TasksService (task assigned) and PlacementsService (candidate
   * placed). Never throws: a notification failing to write should never
   * fail the business operation that triggered it.
   */
  async notify(
    organisationId: string,
    userId: string,
    data: { type: string; title: string; message?: string; link?: string },
  ): Promise<void> {
    try {
      await this.repository.create(organisationId, userId, data);
    } catch (error) {
      this.logger.warn(`Failed to create notification (${data.type}) for user ${userId}: ${error}`);
    }
  }
}
