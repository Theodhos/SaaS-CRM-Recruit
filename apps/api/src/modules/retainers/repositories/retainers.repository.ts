import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { ListRetainersQueryDto, RetainerStatusValue } from '../dto';

const RELATIONS = {
  company: {
    select: {
      id: true,
      name: true,
      pipelineStage: true,
      status: true,
      _count: { select: { jobs: true, placements: true } },
    },
  },
  renewals: { orderBy: { renewalDate: 'desc' as const }, select: { id: true, renewalDate: true, amount: true, status: true, createdAt: true } },
} as const;

/**
 * Tenant-scoped data access for 'retainers'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class RetainersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(organisationId: string, query: ListRetainersQueryDto, now: Date) {
    const db = this.db.forTenant(organisationId);
    // an agreement whose last day has passed is expired, whatever is stored
    const byStatus =
      query.status === 'ACTIVE'
        ? { status: 'ACTIVE' as const, OR: [{ endDate: null }, { endDate: { gte: now } }] }
        : query.status === 'EXPIRED'
          ? { OR: [{ status: 'EXPIRED' as const }, { status: 'ACTIVE' as const, endDate: { lt: now } }] }
          : query.status
            ? { status: query.status }
            : {};
    const where = { ...byStatus, ...(query.companyId ? { companyId: query.companyId } : {}) };
    const [items, totalItems] = await Promise.all([
      db.retainer.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ status: 'asc' }, { endDate: 'asc' }], include: RELATIONS }),
      db.retainer.count({ where }),
    ]);
    return { items, totalItems };
  }

  findAll(organisationId: string) {
    return this.db.forTenant(organisationId).retainer.findMany({ select: { id: true, companyId: true, amount: true, currency: true, status: true, startDate: true, endDate: true } });
  }

  /** Won clients (Pipeline Companies -> Win) that have no running agreement yet. */
  findWonCompanies(organisationId: string) {
    return this.db.forTenant(organisationId).company.findMany({
      where: { deletedAt: null, pipelineStage: 'WIN' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, _count: { select: { jobs: true, placements: true } } },
    });
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).retainer.findFirst({ where: { id }, include: RELATIONS });
  }

  companyExists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .company.count({ where: { id, deletedAt: null } })
      .then((count) => count > 0);
  }

  create(organisationId: string, data: { companyId: string; amount: number; currency: string; status: RetainerStatusValue; startDate: Date; endDate: Date | null }) {
    return this.db.forTenant(organisationId).retainer.create({ data: { ...data, organisationId }, include: RELATIONS });
  }

  update(
    organisationId: string,
    id: string,
    data: { companyId?: string; amount?: number; currency?: string; status?: RetainerStatusValue; startDate?: Date; endDate?: Date | null },
  ) {
    return this.db.forTenant(organisationId).retainer.update({ where: { id }, data, include: RELATIONS });
  }

  /** The agreement is extended and the renewal is written down, together. */
  async renew(organisationId: string, id: string, data: { endDate: Date; amount: number; renewalDate: Date }) {
    const db = this.db.forTenant(organisationId);
    await db.$transaction([
      db.renewal.create({ data: { organisationId, retainerId: id, renewalDate: data.renewalDate, amount: data.amount, status: 'RENEWED' } }),
      db.retainer.update({ where: { id }, data: { endDate: data.endDate, amount: data.amount, status: 'ACTIVE' } }),
    ]);
    return this.findById(organisationId, id);
  }

  delete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).retainer.delete({ where: { id } });
  }
}
