import type { Prisma } from '@crm/database';
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';

const SELECT = { id: true, name: true, slug: true, logoUrl: true, status: true, settings: true, createdAt: true } as const;

/**
 * The organisation is the tenant itself, not a row inside one, so it is read by its id on the raw client —
 * the id always comes from the session (CurrentTenant), never from the request.
 */
@Injectable()
export class OrganisationsRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: string) {
    return this.db.client.organisation.findUnique({ where: { id }, select: SELECT });
  }

  update(id: string, data: { name?: string; settings?: Prisma.InputJsonObject }) {
    return this.db.client.organisation.update({ where: { id }, data, select: SELECT });
  }
}
