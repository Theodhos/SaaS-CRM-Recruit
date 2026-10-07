import { totalPages } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { CreateFeeDto, FeeStatusValue, ListFeesQueryDto, UpdateFeeDto } from '../dto';
import { FeesRepository } from '../repositories/fees.repository';

type Money = Record<string, number>;

const add = (totals: Money, currency: string, amount: number) => {
  totals[currency] = +((totals[currency] ?? 0) + amount).toFixed(2);
};
const sameMonth = (a: Date, b: Date) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

/**
 * Fees are what the agency charges a client company for a person it placed there — the money side of Active
 * Employees. The amount comes from the pay agreed on the pipeline (the pay calculation in the stage pop-ups):
 *   fee per month = rate/hour × hours/day × days/month × fee %
 * and how often it is charged from how the person was hired (Offer → Approved asks for it):
 *   TEMPORARY  every month while they work there;
 *   PERMANENT  once, when they are hired.
 * A fee goes PENDING → INVOICED → PAID; unpaid past its due date it counts as OVERDUE, whatever is stored.
 */
@Injectable()
export class FeesService {
  constructor(
    private readonly repository: FeesRepository,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private present<T extends { amount: unknown; status: string; dueDate: Date | null }>(fee: T, now: Date) {
    const unpaid = fee.status === 'PENDING' || fee.status === 'INVOICED' || fee.status === 'OVERDUE';
    return {
      ...fee,
      amount: Number(fee.amount),
      status: (unpaid && fee.dueDate && fee.dueDate < now ? 'OVERDUE' : fee.status === 'OVERDUE' ? 'INVOICED' : fee.status) as FeeStatusValue,
    };
  }

  async list(organisationId: string, query: ListFeesQueryDto) {
    const now = new Date();
    const { items, totalItems } = await this.repository.findMany(organisationId, query, now);
    return {
      items: items.map((fee) => this.present(fee, now)),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  /**
   * The figures on top of the Fees page, per currency, and the people a fee still has to be created for:
   * temporary employees without a fee this month, permanent ones without any fee.
   */
  async overview(organisationId: string) {
    const now = new Date();
    const [fees, placements] = await Promise.all([this.repository.findAllForOverview(organisationId), this.repository.findActivePlacementsWithPay(organisationId)]);

    const expectedPerMonth: Money = {};
    const toInvoice: Money = {};
    const awaitingPayment: Money = {};
    const overdue: Money = {};
    const paidThisYear: Money = {};
    let overdueCount = 0;

    for (const raw of fees) {
      const fee = this.present(raw, now);
      if (fee.status === 'PENDING') add(toInvoice, fee.currency, fee.amount);
      if (fee.status === 'INVOICED') add(awaitingPayment, fee.currency, fee.amount);
      if (fee.status === 'OVERDUE') {
        add(overdue, fee.currency, fee.amount);
        overdueCount += 1;
      }
      if (fee.status === 'PAID' && (raw.paidAt ?? raw.createdAt).getUTCFullYear() === now.getUTCFullYear()) add(paidThisYear, fee.currency, fee.amount);
    }

    const suggestions = [];
    for (const placement of placements) {
      const pay = placement.pay;
      const rate = pay ? Number(pay.hourlyRate) : null;
      const percent = pay?.feePercent === null || pay?.feePercent === undefined ? null : Number(pay.feePercent);
      const feePerMonth = pay && rate !== null && percent !== null ? +((rate * pay.hoursPerDay * pay.daysPerMonth * percent) / 100).toFixed(2) : null;
      if (feePerMonth !== null && placement.employmentType === 'TEMPORARY') add(expectedPerMonth, pay!.currency, feePerMonth);

      const theirs = fees.filter((fee) => fee.placementId === placement.id);
      const charged = placement.employmentType === 'TEMPORARY' ? theirs.some((fee) => sameMonth(fee.createdAt, now)) : theirs.length > 0;
      if (charged) continue;
      suggestions.push({
        placementId: placement.id,
        employmentType: placement.employmentType,
        candidate: placement.candidate,
        job: placement.job,
        company: placement.company,
        startDate: placement.startDate,
        amount: feePerMonth,
        currency: pay?.currency ?? 'USD',
        /** How the amount was arrived at — shown next to it. Null when no pay / fee % was recorded on the pipeline. */
        basis: pay && rate !== null && percent !== null ? { hourlyRate: rate, hoursPerDay: pay.hoursPerDay, daysPerMonth: pay.daysPerMonth, feePercent: percent } : null,
        period: placement.employmentType === 'TEMPORARY' ? 'MONTHLY' : 'ONE_OFF',
      });
    }

    return { expectedPerMonth, toInvoice, awaitingPayment, overdue, overdueCount, paidThisYear, activeEmployees: placements.length, suggestions };
  }

  async getById(organisationId: string, id: string) {
    const fee = await this.repository.findById(organisationId, id);
    if (!fee) throw new ResourceNotFoundException('Fee', id);
    return this.present(fee, new Date());
  }

  async create(organisationId: string, userId: string, dto: CreateFeeDto) {
    if (!(await this.repository.placementExists(organisationId, dto.placementId))) throw new ResourceNotFoundException('Placement', dto.placementId);
    const status = dto.status ?? 'PENDING';
    const fee = await this.repository.create(organisationId, {
      placementId: dto.placementId,
      amount: dto.amount,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      status,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      paidAt: status === 'PAID' ? new Date() : null,
    });
    await this.auditLogs.record({ organisationId, userId, action: 'CREATE_FEE', entityType: 'Fee', entityId: fee.id, newValues: dto });
    return this.present(fee, new Date());
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateFeeDto) {
    const existing = await this.repository.findById(organisationId, id);
    if (!existing) throw new ResourceNotFoundException('Fee', id);
    if (dto.placementId && !(await this.repository.placementExists(organisationId, dto.placementId))) throw new ResourceNotFoundException('Placement', dto.placementId);

    const fee = await this.repository.update(organisationId, id, {
      ...(dto.placementId ? { placementId: dto.placementId } : {}),
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}),
      ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
      // the day it was paid is the day it is marked paid; taking "paid" back clears it
      ...(dto.status ? { status: dto.status, paidAt: dto.status === 'PAID' ? (existing.paidAt ?? new Date()) : null } : {}),
    });
    await this.auditLogs.record({ organisationId, userId, action: 'UPDATE_FEE', entityType: 'Fee', entityId: id, oldValues: { status: existing.status, amount: Number(existing.amount) }, newValues: dto });
    return this.present(fee, new Date());
  }

  async remove(organisationId: string, userId: string, id: string) {
    const existing = await this.repository.findById(organisationId, id);
    if (!existing) throw new ResourceNotFoundException('Fee', id);
    await this.repository.delete(organisationId, id);
    await this.auditLogs.record({ organisationId, userId, action: 'DELETE_FEE', entityType: 'Fee', entityId: id });
  }
}
