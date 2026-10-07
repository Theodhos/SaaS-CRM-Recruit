import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateContactDto } from '../dto/create-contact.dto';
import type { ListContactsQueryDto } from '../dto/list-contacts-query.dto';
import type { UpdateContactDto } from '../dto/update-contact.dto';

@Injectable()
export class ContactsRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  async findMany(organisationId: string, query: ListContactsQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { jobTitle: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.contact.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
      }),
      this.cache.cachedCount(organisationId, 'contacts', where, () => db.contact.count({ where })),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).contact.findFirst({
      where: { id, deletedAt: null },
      include: {
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Existence check with the same tenant and soft-delete filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .contact.count({ where: { id, deletedAt: null } })
      .then((count) => count > 0);
  }

  create(organisationId: string, ownerId: string, dto: CreateContactDto) {
    return this.db.forTenant(organisationId).contact.create({
      data: { ...dto, organisationId, ownerId: dto.ownerId ?? ownerId },
    });
  }

  update(organisationId: string, id: string, dto: UpdateContactDto) {
    return this.db.forTenant(organisationId).contact.update({
      where: { id },
      data: dto,
    });
  }

  softDelete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).contact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
