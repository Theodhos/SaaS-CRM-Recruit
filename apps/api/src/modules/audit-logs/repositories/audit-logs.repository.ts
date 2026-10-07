import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';

@Injectable()
export class AuditLogsRepository {
  constructor(private readonly db: DatabaseService) {}

  create(input: {
    organisationId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    oldValues?: unknown;
    newValues?: unknown;
  }) {
    return this.db.forTenant(input.organisationId).auditLog.create({
      data: {
        organisationId: input.organisationId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValues: input.oldValues as never,
        newValues: input.newValues as never,
      },
    });
  }

  async findMany(organisationId: string, params: { skip: number; take: number }) {
    const db = this.db.forTenant(organisationId);
    const [items, totalItems] = await Promise.all([
      db.auditLog.findMany({
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      db.auditLog.count(),
    ]);
    return { items, totalItems };
  }
}
