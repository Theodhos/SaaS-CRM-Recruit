import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { FeeStatusValue, ListFeesQueryDto } from '../dto';

const PLACEMENT = {
  placement: {
    select: {
      id: true,
      status: true,
      employmentType: true,
      startDate: true,
      candidate: { select: { id: true, firstName: true, lastName: true } },
      job: { select: { id: true, title: true } },
      company: { select: { id: true, name: true } },
    },
  },
} as const;

/**
 * Tenant-scoped data access for 'fees'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class FeesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(organisationId: string, query: ListFeesQueryDto, now: Date) {
    const db = this.db.forTenant(organisationId);
    // "Overdue" is a fee still unpaid after its due date — asked for by date, not by a stored status that could go stale
    const unpaid = { status: { in: ['PENDING', 'INVOICED', 'OVERDUE'] as FeeStatusValue[] } };
    const byStatus =
      query.status === 'OVERDUE'
        ? { ...unpaid, dueDate: { lt: now } }
        : query.status === 'PENDING' || query.status === 'INVOICED'
          ? { status: query.status, OR: [{ dueDate: null }, { dueDate: { gte: now } }] }
          : query.status
            ? { status: query.status }
            : {};
    const where = {
      ...byStatus,
      ...(query.placementId ? { placementId: query.placementId } : {}),
      ...(query.companyId ? { placement: { companyId: query.companyId } } : {}),
    };
    const [items, totalItems] = await Promise.all([
      db.fee.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { createdAt: 'desc' }, include: PLACEMENT }),
      db.fee.count({ where }),
    ]);
    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).fee.findFirst({ where: { id }, include: PLACEMENT });
  }

  /** Every fee that still counts (not cancelled), lean — the overview is computed from these. */
  findAllForOverview(organisationId: string) {
    return this.db.forTenant(organisationId).fee.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: { id: true, placementId: true, amount: true, currency: true, status: true, dueDate: true, paidAt: true, createdAt: true },
    });
  }

  /** People working now, with the pay agreed for them on the pipeline (the newest stage record that has a rate). */
  async findActivePlacementsWithPay(organisationId: string) {
    const db = this.db.forTenant(organisationId);
    const placements = await db.placement.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        employmentType: true,
        startDate: true,
        candidateId: true,
        jobId: true,
        candidate: { select: { id: true, firstName: true, lastName: true } },
        job: { select: { id: true, title: true } },
        company: { select: { id: true, name: true } },
      },
    });
    if (placements.length === 0) return [];
    const notes = await db.applicationStageNote.findMany({
      where: {
        hourlyRate: { not: null },
        application: { OR: placements.map((p) => ({ candidateId: p.candidateId, jobId: p.jobId })) },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        hourlyRate: true,
        hoursPerDay: true,
        daysPerMonth: true,
        feePercent: true,
        currency: true,
        application: { select: { candidateId: true, jobId: true } },
      },
    });
    return placements.map((placement) => ({
      ...placement,
      pay: notes.find((n) => n.application.candidateId === placement.candidateId && n.application.jobId === placement.jobId) ?? null,
    }));
  }

  placementExists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .placement.count({ where: { id } })
      .then((count) => count > 0);
  }

  create(organisationId: string, data: { placementId: string; amount: number; currency: string; status: FeeStatusValue; dueDate: Date | null; paidAt: Date | null }) {
    return this.db.forTenant(organisationId).fee.create({ data: { ...data, organisationId }, include: PLACEMENT });
  }

  update(
    organisationId: string,
    id: string,
    data: { placementId?: string; amount?: number; currency?: string; status?: FeeStatusValue; dueDate?: Date | null; paidAt?: Date | null },
  ) {
    return this.db.forTenant(organisationId).fee.update({ where: { id }, data, include: PLACEMENT });
  }

  delete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).fee.delete({ where: { id } });
  }
}
