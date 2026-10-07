import { totalPages } from '@crm/utils';
import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { CreateRetainerDto, ListRetainersQueryDto, RenewRetainerDto, RetainerStatusValue, UpdateRetainerDto } from '../dto';
import { RetainersRepository } from '../repositories/retainers.repository';

type Money = Record<string, number>;

const DAY = 86_400_000;
/** "Ends soon": time to talk to the client about renewing. */
const ENDS_SOON_DAYS = 30;

const add = (totals: Money, currency: string, amount: number) => {
  totals[currency] = +((totals[currency] ?? 0) + amount).toFixed(2);
};

/**
 * A retainer is the standing agreement with a client company: what it pays the agency every month to keep
 * recruiting for it, from a start date to an end date. It is the money side of a company that was won (Pipeline
 * Companies → Win), next to the fees charged per person placed there (see FeesService).
 * ACTIVE until its last day has passed — then it counts as EXPIRED, whatever is stored — or until it is CANCELLED.
 * Renewing extends the end date and keeps a record of the renewal.
 */
@Injectable()
export class RetainersService {
  constructor(
    private readonly repository: RetainersRepository,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private present<T extends { amount: unknown; status: string; endDate: Date | null; renewals?: { amount: unknown }[] }>(retainer: T, now: Date) {
    const status = (retainer.status === 'ACTIVE' && retainer.endDate && retainer.endDate < now ? 'EXPIRED' : retainer.status) as RetainerStatusValue;
    const daysLeft = retainer.endDate ? Math.ceil((retainer.endDate.getTime() - now.getTime()) / DAY) : null;
    return {
      ...retainer,
      amount: Number(retainer.amount),
      status,
      daysLeft,
      endsSoon: status === 'ACTIVE' && daysLeft !== null && daysLeft <= ENDS_SOON_DAYS,
      ...(retainer.renewals ? { renewals: retainer.renewals.map((renewal) => ({ ...renewal, amount: Number(renewal.amount) })) } : {}),
    };
  }

  async list(organisationId: string, query: ListRetainersQueryDto) {
    const now = new Date();
    const { items, totalItems } = await this.repository.findMany(organisationId, query, now);
    return {
      items: items.map((retainer) => this.present(retainer, now)),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  /** The figures on top of the Retainers page, and the won clients that have no agreement running. */
  async overview(organisationId: string) {
    const now = new Date();
    const [retainers, won] = await Promise.all([this.repository.findAll(organisationId), this.repository.findWonCompanies(organisationId)]);
    const perMonth: Money = {};
    let active = 0;
    let endingSoon = 0;
    let expired = 0;
    const covered = new Set<string>();
    for (const raw of retainers) {
      const retainer = this.present(raw, now);
      if (retainer.status === 'ACTIVE') {
        active += 1;
        covered.add(raw.companyId);
        add(perMonth, raw.currency, retainer.amount);
        if (retainer.endsSoon) endingSoon += 1;
      }
      if (retainer.status === 'EXPIRED') expired += 1;
    }
    return {
      active,
      perMonth,
      endingSoon,
      expired,
      withoutRetainer: won.filter((company) => !covered.has(company.id)).map((company) => ({ id: company.id, name: company.name, jobs: company._count.jobs, employees: company._count.placements })),
    };
  }

  async getById(organisationId: string, id: string) {
    const retainer = await this.repository.findById(organisationId, id);
    if (!retainer) throw new ResourceNotFoundException('Retainer', id);
    return this.present(retainer, new Date());
  }

  private assertPeriod(startDate: Date, endDate: Date | null) {
    if (endDate && endDate < startDate) throw new AppException('INVALID_RETAINER_PERIOD', 'The end date is before the start date.', HttpStatus.BAD_REQUEST);
  }

  async create(organisationId: string, userId: string, dto: CreateRetainerDto) {
    if (!(await this.repository.companyExists(organisationId, dto.companyId))) throw new ResourceNotFoundException('Company', dto.companyId);
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    this.assertPeriod(startDate, endDate);
    const retainer = await this.repository.create(organisationId, {
      companyId: dto.companyId,
      amount: dto.amount,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      status: dto.status ?? 'ACTIVE',
      startDate,
      endDate,
    });
    await this.auditLogs.record({ organisationId, userId, action: 'CREATE_RETAINER', entityType: 'Retainer', entityId: retainer.id, newValues: dto });
    return this.present(retainer, new Date());
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateRetainerDto) {
    const existing = await this.repository.findById(organisationId, id);
    if (!existing) throw new ResourceNotFoundException('Retainer', id);
    if (dto.companyId && !(await this.repository.companyExists(organisationId, dto.companyId))) throw new ResourceNotFoundException('Company', dto.companyId);
    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const endDate = dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : existing.endDate;
    this.assertPeriod(startDate, endDate);

    const retainer = await this.repository.update(organisationId, id, {
      ...(dto.companyId ? { companyId: dto.companyId } : {}),
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.startDate ? { startDate } : {}),
      ...(dto.endDate !== undefined ? { endDate } : {}),
    });
    await this.auditLogs.record({ organisationId, userId, action: 'UPDATE_RETAINER', entityType: 'Retainer', entityId: id, newValues: dto });
    return this.present(retainer, new Date());
  }

  /** Extends the agreement by whole months — from its end date, or from today when that has already passed. */
  async renew(organisationId: string, userId: string, id: string, dto: RenewRetainerDto) {
    const existing = await this.repository.findById(organisationId, id);
    if (!existing) throw new ResourceNotFoundException('Retainer', id);
    if (existing.status === 'CANCELLED') throw new AppException('RETAINER_CANCELLED', 'A cancelled retainer cannot be renewed — create a new one.', HttpStatus.CONFLICT);

    const now = new Date();
    const from = existing.endDate && existing.endDate > now ? existing.endDate : now;
    const endDate = new Date(from);
    endDate.setUTCMonth(endDate.getUTCMonth() + dto.months);
    const retainer = await this.repository.renew(organisationId, id, { endDate, amount: dto.amount ?? Number(existing.amount), renewalDate: now });
    await this.auditLogs.record({ organisationId, userId, action: 'RENEW_RETAINER', entityType: 'Retainer', entityId: id, newValues: { months: dto.months, amount: dto.amount, endDate } });
    return this.present(retainer!, new Date());
  }

  async remove(organisationId: string, userId: string, id: string) {
    const existing = await this.repository.findById(organisationId, id);
    if (!existing) throw new ResourceNotFoundException('Retainer', id);
    await this.repository.delete(organisationId, id);
    await this.auditLogs.record({ organisationId, userId, action: 'DELETE_RETAINER', entityType: 'Retainer', entityId: id });
  }
}
