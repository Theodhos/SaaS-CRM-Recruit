import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { ListNotificationsQueryDto } from '../dto/list-notifications-query.dto';

/**
 * Tenant-scoped data access for 'notifications'. Always resolve via
 * `this.db.forTenant(organisationId)` — every method here ALSO filters by
 * `userId`, since a notification belongs to one user, not the whole org.
 */
@Injectable()
export class NotificationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(organisationId: string, userId: string, query: ListNotificationsQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = { userId, ...(query.unreadOnly ? { readAt: null } : {}) };

    const [items, totalItems] = await Promise.all([
      db.notification.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.notification.count({ where }),
    ]);

    return { items, totalItems };
  }

  countUnread(organisationId: string, userId: string) {
    return this.db.forTenant(organisationId).notification.count({ where: { userId, readAt: null } });
  }

  findById(organisationId: string, userId: string, id: string) {
    return this.db.forTenant(organisationId).notification.findFirst({ where: { id, userId } });
  }

  create(
    organisationId: string,
    userId: string,
    data: { type: string; title: string; message?: string; link?: string },
  ) {
    return this.db.forTenant(organisationId).notification.create({
      data: { organisationId, userId, ...data },
    });
  }

  markRead(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  markAllRead(organisationId: string, userId: string) {
    return this.db.forTenant(organisationId).notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  delete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).notification.delete({ where: { id } });
  }
}
